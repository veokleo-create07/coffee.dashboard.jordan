-- Phase 6: record actual arrival and departure on existing reservations.
-- Apply only after the Phase 5 staff reservation migration is installed.
-- This migration does not change reservation capacity, booking rules, RLS,
-- staff authorization, public booking RPCs, or existing capacity triggers.

BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS departed_at timestamptz;

-- Timestamps are written only as a consequence of the existing staff RPC
-- changing a reservation status. Existing arrived rows are not backfilled:
-- their actual arrival times cannot be inferred safely.
CREATE OR REPLACE FUNCTION public.record_reservation_occupancy_times()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.arrived_at IS NOT NULL
       OR NEW.departed_at IS NOT NULL
       OR NEW.status IN ('arrived', 'completed') THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'OCCUPANCY_TIMESTAMP_FORBIDDEN: occupancy timestamps are recorded by staff status actions';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'arrived' THEN
      IF OLD.status NOT IN ('pending', 'confirmed')
         OR OLD.arrived_at IS NOT NULL
         OR OLD.departed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_TRANSITION';
      END IF;

      NEW.arrived_at := clock_timestamp();
      NEW.departed_at := NULL;
      RETURN NEW;
    END IF;

    IF NEW.status = 'completed' THEN
      -- Phase 5 permits confirmed -> completed. Preserve that transition
      -- without inventing an arrival time when no check-in was recorded.
      IF OLD.status NOT IN ('arrived', 'confirmed') OR OLD.departed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_TRANSITION';
      END IF;

      NEW.arrived_at := OLD.arrived_at;
      NEW.departed_at := clock_timestamp();
      RETURN NEW;
    END IF;

    IF OLD.status = 'arrived' AND NEW.status = 'cancelled' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'VISIT_STILL_ACTIVE: mark the guest as free before cancelling';
    END IF;

    IF NEW.status = 'no_show' THEN
      IF OLD.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_TRANSITION';
      END IF;
      IF clock_timestamp() < OLD.starts_at + interval '15 minutes' THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0001',
          MESSAGE = 'NO_SHOW_TOO_EARLY: wait 15 minutes after the scheduled time';
      END IF;
    END IF;
  END IF;

  -- Callers cannot directly alter historical timestamps, even if they can
  -- update other reservation fields through existing authorized paths.
  IF NEW.arrived_at IS DISTINCT FROM OLD.arrived_at
     OR NEW.departed_at IS DISTINCT FROM OLD.departed_at THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'OCCUPANCY_TIMESTAMP_FORBIDDEN: timestamps are written by staff status actions';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_reservation_occupancy_times()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS record_reservation_occupancy_times ON public.reservations;
CREATE TRIGGER record_reservation_occupancy_times
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.record_reservation_occupancy_times();

COMMIT;
