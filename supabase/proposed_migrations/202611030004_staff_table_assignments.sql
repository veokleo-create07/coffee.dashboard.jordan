-- PROPOSAL ONLY. Apply after the existing staff authorization and occupancy migrations.
-- Table assignments are operational metadata and do not participate in capacity rules.
BEGIN;

CREATE TABLE IF NOT EXISTS public.reservation_table_assignments (
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_number integer NOT NULL CHECK (table_number IN (1,2,3,4,5,6,7,11,22,33,44,55,109,110,111,112,113)),
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (reservation_id, table_number),
  UNIQUE (table_number)
);
ALTER TABLE public.reservation_table_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reservation_table_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.reservation_table_assignments TO authenticated;
DROP POLICY IF EXISTS "Staff can read table assignments" ON public.reservation_table_assignments;
CREATE POLICY "Staff can read table assignments" ON public.reservation_table_assignments FOR SELECT TO authenticated USING (public.staff_reservation_access(false));

CREATE OR REPLACE FUNCTION public.staff_arrive_with_tables(p_reservation_id uuid, p_tables integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid := auth.uid(); v_row public.reservations%rowtype; v_table integer;
BEGIN
  IF v_actor IS NULL OR NOT public.staff_reservation_access(false) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='NOT_STAFF'; END IF;
  IF p_tables IS NULL OR cardinality(p_tables) < 1 OR cardinality(p_tables) > 17 OR p_tables IS DISTINCT FROM ARRAY(SELECT DISTINCT unnest(p_tables) ORDER BY 1) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_TABLES'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_tables) t(table_number) WHERE table_number NOT IN (1,2,3,4,5,6,7,11,22,33,44,55,109,110,111,112,113)) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_TABLES'; END IF;
  SELECT * INTO v_row FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='NOT_FOUND'; END IF;
  IF v_row.status <> 'confirmed' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_TRANSITION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('altstadtliebe-table-assignments-v1',0));
  IF EXISTS (SELECT 1 FROM public.reservation_table_assignments a WHERE a.table_number = ANY(p_tables)) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='TABLE_OCCUPIED'; END IF;
  UPDATE public.reservations SET status='arrived', updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_row;
  FOREACH v_table IN ARRAY p_tables LOOP INSERT INTO public.reservation_table_assignments(reservation_id,table_number) VALUES (p_reservation_id,v_table); END LOOP;
  RETURN to_jsonb(v_row);
END; $$;
REVOKE ALL ON FUNCTION public.staff_arrive_with_tables(uuid,integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_arrive_with_tables(uuid,integer[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_assign_reservation_tables(p_reservation_id uuid, p_tables integer[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_reservation_access(false) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='NOT_STAFF'; END IF;
  IF p_tables IS NULL OR cardinality(p_tables) < 1 OR cardinality(p_tables) > 17 OR EXISTS (SELECT 1 FROM unnest(p_tables) t(table_number) WHERE table_number NOT IN (1,2,3,4,5,6,7,11,22,33,44,55,109,110,111,112,113)) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_TABLES'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE id=p_reservation_id AND status='arrived') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_TRANSITION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('altstadtliebe-table-assignments-v1',0));
  IF EXISTS (SELECT 1 FROM public.reservation_table_assignments a WHERE a.table_number=ANY(p_tables) AND a.reservation_id<>p_reservation_id) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='TABLE_OCCUPIED'; END IF;
  DELETE FROM public.reservation_table_assignments WHERE reservation_id=p_reservation_id;
  INSERT INTO public.reservation_table_assignments(reservation_id,table_number) SELECT p_reservation_id, unnest(p_tables);
END; $$;
REVOKE ALL ON FUNCTION public.staff_assign_reservation_tables(uuid,integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_assign_reservation_tables(uuid,integer[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_reservation_tables_on_departure() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status IN ('completed','cancelled','no_show') OR NEW.departed_at IS NOT NULL THEN DELETE FROM public.reservation_table_assignments WHERE reservation_id=NEW.id; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.release_reservation_tables_on_departure() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS release_reservation_tables_on_departure ON public.reservations;
CREATE TRIGGER release_reservation_tables_on_departure AFTER UPDATE OF status, departed_at ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.release_reservation_tables_on_departure();
COMMIT;
