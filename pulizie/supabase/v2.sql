-- Monitoraggio Pulizie v2: PIN personali, ora server, foto, promemoria
create table if not exists pulizie.persona_pin (person text primary key, pin_hash text not null, updated_at timestamptz default now());
create table if not exists pulizie.sessione (token text primary key, person text not null, created_at timestamptz default now());
create table if not exists pulizie.login_try (ts timestamptz default now(), person text, ok boolean);
create table if not exists pulizie.foto (id bigserial primary key, log_id text not null, key text not null, data text not null, created_at timestamptz default now());
create index if not exists foto_log_idx on pulizie.foto(log_id);
alter table pulizie.log add column if not exists late boolean default false;
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'pulizie' loop
    execute format('alter table pulizie.%I enable row level security', t);
    execute format('revoke all on pulizie.%I from public, anon, authenticated', t);
  end loop; end $$;

create or replace function pulizie.rome_now() returns timestamp language sql stable as $$ select now() at time zone 'Europe/Rome' $$;

create or replace function pulizie.who(p_token text) returns text language plpgsql stable security definer set search_path = pulizie as $$
declare p text;
begin
  select person into p from pulizie.sessione where token = p_token;
  if p is null then raise exception 'Accesso scaduto: inserisci di nuovo il tuo PIN'; end if;
  return p;
end $$;
revoke all on function pulizie.who(text) from public, anon, authenticated;

-- login: nome + PIN personale → token del telefono
create or replace function public.pul_login(p_person text, p_pin text) returns text language plpgsql security definer set search_path = pulizie, extensions as $$
declare h text; tok text; v_ok boolean;
begin
  if (select count(*) from pulizie.login_try l where l.person = p_person and not l.ok and l.ts > now() - interval '10 minutes') >= 5 then
    raise exception 'Troppi tentativi: riprova tra 10 minuti';
  end if;
  select pin_hash into h from pulizie.persona_pin where person = p_person;
  v_ok := h is not null and crypt(coalesce(p_pin,''), h) = h;
  insert into pulizie.login_try(person, ok) values (p_person, v_ok);
  delete from pulizie.login_try where ts < now() - interval '1 day';
  if not v_ok then raise exception 'PIN non valido'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into pulizie.sessione(token, person) values (tok, p_person);
  return tok;
end $$;

create or replace function public.pul_whoami(p_token text) returns text language sql stable security definer set search_path = pulizie as $$
  select person from pulizie.sessione where token = p_token
$$;

drop function if exists public.pul_save_log(jsonb, jsonb);
-- registrazione: persona dal token, data = oggi, ora dal server
create or replace function public.pul_save_log(p_token text, rec jsonb, take boolean default false, photos jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare me text := pulizie.who(p_token); d date := (pulizie.rome_now())::date; old record; v_ts text; v_late boolean; dl text; ph jsonb;
begin
  if (rec->>'date')::date <> d then raise exception 'Puoi registrare solo i compiti di oggi'; end if;
  if rec->>'role' not in ('inc','chi','ape') then raise exception 'Ruolo non valido'; end if;
  if length(coalesce(rec->>'note','')) > 1000 then raise exception 'Nota troppo lunga'; end if;
  if jsonb_array_length(coalesce(photos,'[]'::jsonb)) > 6 then raise exception 'Troppe foto'; end if;
  select * into old from pulizie.log where date = d and role = rec->>'role' order by created_at desc limit 1;
  v_ts := to_char(pulizie.rome_now(), 'YYYY-MM-DD"T"HH24:MI');
  dl := coalesce((select data->>'deadline' from pulizie.config where id = 1), '18:00');
  if old.id is not null then
    v_ts := old.ts; v_late := old.late;
    update pulizie.log set person = me, items = rec->'items', verify = rec->'verify', sala = rec->>'sala', note = rec->>'note', updated_at = now() where id = old.id;
  else
    v_late := rec->>'role' = 'inc' and to_char(pulizie.rome_now(), 'HH24:MI') > dl;
    insert into pulizie.log(id, date, role, person, items, verify, sala, note, ts, ref, late)
    values (rec->>'id', d, rec->>'role', me, rec->'items', rec->'verify', rec->>'sala', rec->>'note', v_ts, nullif(rec->>'ref','')::date, v_late);
  end if;
  if take then
    insert into pulizie.swap(date, role, person) values (d, rec->>'role', me) on conflict (date, role) do update set person = excluded.person;
  end if;
  for ph in select * from jsonb_array_elements(coalesce(photos,'[]'::jsonb)) loop
    if length(ph->>'data') > 400000 then raise exception 'Foto troppo grande'; end if;
    delete from pulizie.foto where log_id = coalesce(old.id, rec->>'id') and key = ph->>'key';
    insert into pulizie.foto(log_id, key, data) values (coalesce(old.id, rec->>'id'), ph->>'key', ph->>'data');
  end loop;
  return jsonb_build_object('id', coalesce(old.id, rec->>'id'), 'ts', v_ts, 'late', v_late, 'person', me);
end $$;

drop function if exists public.pul_push_sub(text, jsonb);
create or replace function public.pul_push_sub(p_token text, p_sub jsonb) returns void language plpgsql security definer set search_path = pulizie as $$
declare me text := pulizie.who(p_token);
begin
  if p_sub->>'endpoint' is null or length(p_sub::text) > 4000 then raise exception 'Iscrizione non valida'; end if;
  insert into pulizie.push_sub(endpoint, person, sub) values (p_sub->>'endpoint', me, p_sub)
  on conflict (endpoint) do update set person = excluded.person, sub = excluded.sub, created_at = now();
end $$;

create or replace function public.pul_load() returns jsonb language sql stable security definer set search_path = pulizie as $$
  select jsonb_build_object(
    'cfg', coalesce((select data from pulizie.config where id = 1), '{}'::jsonb),
    'impresa', coalesce((select jsonb_agg(to_char(date,'YYYY-MM-DD') order by date) from pulizie.impresa where date > current_date - 120), '[]'::jsonb),
    'logs', coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'date',to_char(l.date,'YYYY-MM-DD'),'role',l.role,'person',l.person,'items',l.items,'verify',l.verify,'sala',l.sala,'note',l.note,'ts',l.ts,'ref',to_char(l.ref,'YYYY-MM-DD'),'late',l.late,
        'foto',(select coalesce(jsonb_agg(f.key),'[]'::jsonb) from pulizie.foto f where f.log_id = l.id))) from pulizie.log l where l.date > current_date - 120), '[]'::jsonb),
    'swaps', coalesce((select jsonb_agg(jsonb_build_object('date',to_char(date,'YYYY-MM-DD'),'role',role,'person',person)) from pulizie.swap where date > current_date - 120), '[]'::jsonb),
    'turni', coalesce((select jsonb_agg(jsonb_build_object('date',to_char(date,'YYYY-MM-DD'),'role',role,'person',person)) from pulizie.turni where date between current_date - 1 and current_date + 30), '[]'::jsonb),
    'today', to_char(pulizie.rome_now(),'YYYY-MM-DD'))
$$;

-- amministrazione: PIN personali e foto
create or replace function public.pul_admin_people(p_pin text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('person',person,'updated',to_char(updated_at at time zone 'Europe/Rome','DD/MM/YYYY'))) from pulizie.persona_pin), '[]'::jsonb);
end $$;

create or replace function public.pul_admin_new_pin(p_pin text, p_person text) returns text language plpgsql security definer set search_path = pulizie, extensions as $$
declare np text := lpad((floor(random()*10000))::int::text, 4, '0');
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  insert into pulizie.persona_pin(person, pin_hash) values (p_person, crypt(np, gen_salt('bf')))
  on conflict (person) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from pulizie.sessione where person = p_person;
  return np;
end $$;

create or replace function public.pul_admin_foto(p_pin text, p_log text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key',key,'data',data)) from pulizie.foto where log_id = p_log), '[]'::jsonb);
end $$;

-- notifiche: 'domani' (incaricato di domani), 'inc' (incaricato non ha registrato), 'chi' (controllo serale non registrato)
drop function if exists public.pul_push_job(text);
create or replace function public.pul_push_job(p_secret text, p_kind text default 'domani') returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare d date := (pulizie.rome_now())::date + case when p_kind = 'domani' then 1 else 0 end;
        r text := case when p_kind = 'chi' then 'chi' else 'inc' end; tag text := p_kind;
begin
  if p_secret is distinct from (select v from pulizie.secret where k = 'cron_secret') then raise exception 'no'; end if;
  return jsonb_build_object(
    'date', to_char(d,'YYYY-MM-DD'), 'kind', p_kind,
    'deadline', coalesce((select data->>'deadline' from pulizie.config where id = 1), '18:00'),
    'vapid', jsonb_build_object('public',(select v from pulizie.secret where k='vapid_public'),'private',(select v from pulizie.secret where k='vapid_private'),'subject',(select v from pulizie.secret where k='vapid_subject')),
    'targets', coalesce((select jsonb_agg(jsonb_build_object('person',t.person,'role',tag,'imp',t.imp,'subs',(select jsonb_agg(s.sub) from pulizie.push_sub s where s.person = t.person)))
      from pulizie.turni t where t.date = d and t.role = r and t.person is not null and t.person <> ''
        and (p_kind = 'domani' or not exists (select 1 from pulizie.log l where l.date = d and l.role = r))
        and not exists (select 1 from pulizie.push_sent x where x.date = d and x.person = t.person and x.role = tag)), '[]'::jsonb));
end $$;

revoke all on function public.pul_push_job(text,text) from public, anon, authenticated;
grant execute on function public.pul_push_job(text,text) to service_role;
revoke all on function public.pul_login(text,text), public.pul_whoami(text), public.pul_save_log(text,jsonb,boolean,jsonb), public.pul_push_sub(text,jsonb), public.pul_load(), public.pul_admin_people(text), public.pul_admin_new_pin(text,text), public.pul_admin_foto(text,text) from public;
grant execute on function public.pul_login(text,text), public.pul_whoami(text), public.pul_save_log(text,jsonb,boolean,jsonb), public.pul_push_sub(text,jsonb), public.pul_load(), public.pul_admin_people(text), public.pul_admin_new_pin(text,text), public.pul_admin_foto(text,text) to anon, authenticated;
