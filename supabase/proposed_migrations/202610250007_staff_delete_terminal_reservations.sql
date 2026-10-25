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

  v_updated := replace(
    v_definition,
    $fn$or (v_before.status = 'arrived' and p_target_status in ('completed', 'cancelled'))$fn$,
    $fn$or (v_before.status = 'arrived' and p_target_status in ('completed', 'cancelled'))
      or (v_before.status in ('completed', 'no_show') and p_target_status = 'cancelled')$fn$
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'staff_manage_reservation transition clause did not match; inspect the live definition before applying';
  END IF;

  EXECUTE v_updated;
END;
$migration$;
