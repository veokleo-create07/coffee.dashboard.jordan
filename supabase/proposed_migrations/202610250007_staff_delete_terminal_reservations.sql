-- Allow authorized staff to soft-delete completed and no-show reservations.
-- The existing audited staff_manage_reservation RPC is preserved; this only
-- extends its cancellation transition. Cancelled rows remain in history.

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_signature constant text := 'public.staff_manage_reservation(text, uuid, text, text, text, integer, date, time, text, text, text, text, text)';
BEGIN
  SELECT pg_get_functiondef(v_signature::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'staff_manage_reservation function was not found';
  END IF;

  IF position($phrase$(v_before.status in ('completed', 'no_show') and p_target_status = 'cancelled')$phrase$ in v_definition) > 0 THEN
    RAISE NOTICE 'Terminal reservation delete transition is already enabled';
    RETURN;
  END IF;

  v_updated := regexp_replace(
    v_definition,
    $pattern$p_target_status\s+in\s*\(\s*'completed'\s*,\s*'cancelled'\s*\)$pattern$,
    $replacement$p_target_status in ('completed', 'cancelled')
      or (v_before.status in ('completed', 'no_show') and p_target_status = 'cancelled')$replacement$,
    'g'
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'staff_manage_reservation transition clause did not match; inspect the live definition before applying';
  END IF;

  EXECUTE v_updated;
END;
$migration$;

-- Capacity assertions must not reject a cancellation merely because the
-- schedule was already over capacity. The staff RPC remains authorization
-- gated; this flag is transaction-local and only bypasses the assertion for
-- this authorized status update.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_signature constant text :=
    'public.staff_manage_reservation(text, uuid, text, text, text, integer, date, time, text, text, text, text, text)';
BEGIN
  SELECT pg_get_functiondef(v_signature::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'staff_manage_reservation function was not found';
  END IF;

  IF position($marker$set_config('app.staff_rule_override', 'true', true)$marker$ IN v_definition) > 0 THEN
    RAISE NOTICE 'Staff cancellation capacity bypass is already enabled';
    RETURN;
  END IF;

  v_updated := regexp_replace(
    v_definition,
    $pattern$update\s+public\.reservations\s+set\s+status\s*=\s*p_target_status,\s*updated_at\s*=\s*now\(\)\s+where\s+id\s*=\s*p_reservation_id\s+returning\s+\*\s+into\s+v_after;$pattern$,
    $replacement$if p_target_status = 'cancelled' then
      perform set_config('app.staff_rule_override', 'true', true);
    end if;
    update public.reservations set status = p_target_status, updated_at = now() where id = p_reservation_id returning * into v_after;$replacement$,
    'in'
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not find the staff status update statement';
  END IF;

  EXECUTE v_updated;
END;
$migration$;
