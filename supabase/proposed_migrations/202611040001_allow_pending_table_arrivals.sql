-- Allow table assignment when an existing reservation still has the legacy
-- pending status. The dashboard presents pending reservations as confirmed,
-- and the existing occupancy trigger already permits pending -> arrived.
-- Proposal only: apply this in Supabase after reviewing the live function.

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_signature constant text := 'public.staff_arrive_with_tables(uuid, integer[])';
BEGIN
  SELECT pg_get_functiondef(v_signature::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'staff_arrive_with_tables function was not found';
  END IF;

  IF position($phrase$v_row.status NOT IN ('pending', 'confirmed')$phrase$ IN v_definition) > 0 THEN
    RAISE NOTICE 'Pending table arrivals are already enabled';
    RETURN;
  END IF;

  v_updated := replace(
    v_definition,
    $needle$v_row.status <> 'confirmed'$needle$,
    $replacement$v_row.status NOT IN ('pending', 'confirmed')$replacement$
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not find the confirmed-only arrival transition; inspect the live definition before applying';
  END IF;

  EXECUTE v_updated;
END;
$migration$;
