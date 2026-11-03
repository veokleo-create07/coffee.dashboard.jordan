-- Allow staff to create walk-in and phone reservations without contact data.
-- The client already treats email and phone as optional; this aligns the
-- SECURITY DEFINER RPC so a successful form submission is persisted.
do $$
declare
  v_signature constant text := 'public.staff_manage_reservation(text, uuid, text, text, text, integer, date, time, text, text, text, text, text)';
  v_source text;
  v_updated text;
begin
  select pg_get_functiondef(p.oid)
    into v_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid = v_signature::regprocedure;

  if v_source is null then
    raise exception 'staff_manage_reservation function was not found';
  end if;

  v_updated := replace(
    v_source,
    $needle$
       or (
         nullif(btrim(p_customer_email), '') is null
         and nullif(btrim(p_customer_phone), '') is null
       )$needle$,
    ''
  );
  v_updated := replace(
    v_updated,
    $needle$or (nullif(btrim(p_customer_email), '') is null and nullif(btrim(p_customer_phone), '') is null)$needle$,
    ''
  );

  if v_updated = v_source then
    raise notice 'staff_manage_reservation already allows empty staff contacts';
  else
    execute v_updated;
  end if;
end
$$;
