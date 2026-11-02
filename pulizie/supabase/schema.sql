-- Monitoraggio Pulizie Effestudio — schema "pulizie" (progetto Supabase spring-league)
-- Tabelle non esposte via API: accesso solo tramite funzioni public.pul_* (security definer)
create schema if not exists pulizie;
revoke all on schema pulizie from public, anon, authenticated;

create table if not exists pulizie.config (id int primary key default 1 check (id = 1), data jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
create table if not exists pulizie.impresa (date date primary key);
create table if not exists pulizie.log (
  id text primary key, date date not null, role text not null check (role in ('inc','chi','ape')),
  person text not null, items jsonb, verify jsonb, sala text, note text, ts text, ref date,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists log_date_idx on pulizie.log(date);
create table if not exists pulizie.swap (date date not null, role text not null check (role in ('inc','chi','ape')), person text not null, primary key (date, role));
create table if not exists pulizie.multe (key text primary key, date date not null, person text not null, motivo text, importo numeric default 0,
  stato text not null default 'da confermare' check (stato in ('da confermare','confermata','decurtata','annullata')), updated_at timestamptz default now());
create table if not exists pulizie.turni (date date not null, role text not null check (role in ('inc','chi','ape')), person text, imp boolean default false, updated_at timestamptz default now(), primary key (date, role));
create table if not exists pulizie.push_sub (endpoint text primary key, person text not null, sub jsonb not null, created_at timestamptz default now());
create table if not exists pulizie.push_sent (date date not null, person text not null, role text not null, sent_at timestamptz default now(), primary key (date, person, role));
create table if not exists pulizie.secret (k text primary key, v text not null);
create table if not exists pulizie.admin_try (ts timestamptz default now(), ok boolean);

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'pulizie' loop
    execute format('alter table pulizie.%I enable row level security', t);
    execute format('revoke all on pulizie.%I from public, anon, authenticated', t);
  end loop; end $$;

-- ---------- PIN amministrazione (hash) ----------
create or replace function pulizie.is_admin(p_pin text) returns boolean language plpgsql security definer set search_path = pulizie, extensions as $$
declare h text; ok boolean;
begin
  if (select count(*) from pulizie.admin_try where not ok and ts > now() - interval '10 minutes') >= 10 then
    raise exception 'Troppi tentativi: riprova tra 10 minuti';
  end if;
  select v into h from pulizie.secret where k = 'admin_pin';
  ok := h is not null and crypt(coalesce(p_pin,''), h) = h;
  insert into pulizie.admin_try(ok) values (ok);
  delete from pulizie.admin_try where ts < now() - interval '1 day';
  return ok;
end $$;
revoke all on function pulizie.is_admin(text) from public, anon, authenticated;

-- ---------- staff ----------
create or replace function public.pul_load() returns jsonb language sql stable security definer set search_path = pulizie as $$
  select jsonb_build_object(
    'cfg', coalesce((select data from pulizie.config where id = 1), '{}'::jsonb),
    'impresa', coalesce((select jsonb_agg(to_char(date,'YYYY-MM-DD') order by date) from pulizie.impresa where date > current_date - 120), '[]'::jsonb),
    'logs', coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',to_char(date,'YYYY-MM-DD'),'role',role,'person',person,'items',items,'verify',verify,'sala',sala,'note',note,'ts',ts,'ref',to_char(ref,'YYYY-MM-DD'))) from pulizie.log where date > current_date - 120), '[]'::jsonb),
    'swaps', coalesce((select jsonb_agg(jsonb_build_object('date',to_char(date,'YYYY-MM-DD'),'role',role,'person',person)) from pulizie.swap where date > current_date - 120), '[]'::jsonb))
$$;

create or replace function public.pul_save_log(rec jsonb, swaps jsonb default '[]'::jsonb) returns void language plpgsql security definer set search_path = pulizie as $$
declare s jsonb;
begin
  if length(rec->>'id') > 60 or length(coalesce(rec->>'note','')) > 1000 or length(rec->>'person') > 80 then raise exception 'Dati non validi'; end if;
  if (rec->>'date')::date < current_date - 7 or (rec->>'date')::date > current_date + 1 then raise exception 'Data non valida'; end if;
  insert into pulizie.log(id,date,role,person,items,verify,sala,note,ts,ref)
  values (rec->>'id',(rec->>'date')::date,rec->>'role',rec->>'person',rec->'items',rec->'verify',rec->>'sala',rec->>'note',rec->>'ts',nullif(rec->>'ref','')::date)
  on conflict (id) do update set person=excluded.person, items=excluded.items, verify=excluded.verify, sala=excluded.sala, note=excluded.note, ts=excluded.ts, ref=excluded.ref, updated_at=now();
  for s in select * from jsonb_array_elements(coalesce(swaps,'[]'::jsonb)) loop
    insert into pulizie.swap(date,role,person) values ((s->>'date')::date, s->>'role', s->>'person')
    on conflict (date,role) do update set person = excluded.person;
  end loop;
end $$;

-- calendario calcolato dalle app (serve alle notifiche del giorno prima)
create or replace function public.pul_sync_turni(rows jsonb) returns void language plpgsql security definer set search_path = pulizie as $$
declare r jsonb;
begin
  if jsonb_array_length(rows) > 200 then raise exception 'Troppi turni'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    if (r->>'date')::date >= current_date and (r->>'date')::date <= current_date + 60 then
      insert into pulizie.turni(date,role,person,imp) values ((r->>'date')::date, r->>'role', nullif(r->>'person',''), coalesce((r->>'imp')::boolean,false))
      on conflict (date,role) do update set person = excluded.person, imp = excluded.imp, updated_at = now();
    end if;
  end loop;
end $$;

create or replace function public.pul_push_sub(p_person text, p_sub jsonb) returns void language plpgsql security definer set search_path = pulizie as $$
begin
  if p_sub->>'endpoint' is null or length(p_sub::text) > 4000 or length(p_person) > 80 then raise exception 'Iscrizione non valida'; end if;
  insert into pulizie.push_sub(endpoint, person, sub) values (p_sub->>'endpoint', p_person, p_sub)
  on conflict (endpoint) do update set person = excluded.person, sub = excluded.sub, created_at = now();
end $$;

create or replace function public.pul_vapid() returns text language sql stable security definer set search_path = pulizie as $$
  select v from pulizie.secret where k = 'vapid_public'
$$;

-- ---------- amministrazione ----------
create or replace function public.pul_admin_check(p_pin text) returns boolean language sql security definer set search_path = pulizie as $$
  select pulizie.is_admin(p_pin)
$$;

create or replace function public.pul_admin_load(p_pin text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  return jsonb_build_object(
    'multe', coalesce((select jsonb_agg(jsonb_build_object('key',key,'date',to_char(date,'YYYY-MM-DD'),'person',person,'motivo',motivo,'importo',importo,'stato',stato)) from pulizie.multe), '[]'::jsonb),
    'push', coalesce((select jsonb_agg(distinct person) from pulizie.push_sub), '[]'::jsonb));
end $$;

create or replace function public.pul_admin_save(p_pin text, kind text, payload jsonb) returns void language plpgsql security definer set search_path = pulizie, extensions as $$
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  if kind = 'config' then
    insert into pulizie.config(id,data) values (1,payload) on conflict (id) do update set data = excluded.data, updated_at = now();
  elsif kind = 'impresa_add' then
    insert into pulizie.impresa(date) values ((payload->>'date')::date) on conflict do nothing;
  elsif kind = 'impresa_del' then
    delete from pulizie.impresa where date = (payload->>'date')::date;
  elsif kind = 'multa' then
    insert into pulizie.multe(key,date,person,motivo,importo,stato) values (payload->>'key',(payload->>'date')::date,payload->>'person',payload->>'motivo',coalesce((payload->>'importo')::numeric,0),payload->>'stato')
    on conflict (key) do update set stato = excluded.stato, importo = excluded.importo, updated_at = now();
  elsif kind = 'pin' then
    if length(payload->>'pin') < 4 then raise exception 'PIN troppo corto'; end if;
    update pulizie.secret set v = crypt(payload->>'pin', gen_salt('bf')) where k = 'admin_pin';
  else raise exception 'Operazione sconosciuta'; end if;
end $$;

-- ---------- notifiche (solo edge function con segreto) ----------
create or replace function public.pul_push_job(p_secret text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare tomorrow date := (now() at time zone 'Europe/Rome')::date + 1;
begin
  if p_secret is distinct from (select v from pulizie.secret where k = 'cron_secret') then raise exception 'no'; end if;
  return jsonb_build_object(
    'date', to_char(tomorrow,'YYYY-MM-DD'),
    'vapid', jsonb_build_object('public',(select v from pulizie.secret where k='vapid_public'),'private',(select v from pulizie.secret where k='vapid_private'),'subject',(select v from pulizie.secret where k='vapid_subject')),
    'targets', coalesce((select jsonb_agg(jsonb_build_object('person',t.person,'role',t.role,'imp',t.imp,'subs',(select jsonb_agg(s.sub) from pulizie.push_sub s where s.person = t.person)))
      from pulizie.turni t where t.date = tomorrow and t.role = 'inc' and t.person is not null
        and not exists (select 1 from pulizie.push_sent x where x.date = tomorrow and x.person = t.person and x.role = t.role)), '[]'::jsonb));
end $$;

create or replace function public.pul_push_done(p_secret text, p_date date, sent jsonb, gone jsonb) returns void language plpgsql security definer set search_path = pulizie as $$
declare r jsonb;
begin
  if p_secret is distinct from (select v from pulizie.secret where k = 'cron_secret') then raise exception 'no'; end if;
  for r in select * from jsonb_array_elements(coalesce(sent,'[]'::jsonb)) loop
    insert into pulizie.push_sent(date,person,role) values (p_date, r->>'person', r->>'role') on conflict do nothing;
  end loop;
  delete from pulizie.push_sub where endpoint in (select jsonb_array_elements_text(coalesce(gone,'[]'::jsonb)));
end $$;

revoke all on function public.pul_push_job(text), public.pul_push_done(text,date,jsonb,jsonb) from public;
grant execute on function public.pul_load(), public.pul_save_log(jsonb,jsonb), public.pul_sync_turni(jsonb), public.pul_push_sub(text,jsonb), public.pul_vapid(),
  public.pul_admin_check(text), public.pul_admin_load(text), public.pul_admin_save(text,text,jsonb) to anon, authenticated;
grant execute on function public.pul_push_job(text), public.pul_push_done(text,date,jsonb,jsonb) to service_role;
