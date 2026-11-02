-- Monitoraggio Pulizie v3: registrazione con email, PIN inviato per email (Apps Script dell'account Effestudio)
alter table pulizie.persona_pin add column if not exists email text;
create table if not exists pulizie.richiesta (id bigserial primary key, person text not null, email text not null,
  stato text not null default 'attesa' check (stato in ('attesa','approvata','rifiutata')), created_at timestamptz default now());
create table if not exists pulizie.reset_try (ts timestamptz default now(), person text);
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'pulizie' loop
    execute format('alter table pulizie.%I enable row level security', t);
    execute format('revoke all on pulizie.%I from public, anon, authenticated', t);
  end loop; end $$;

-- invio email tramite web app Apps Script (URL e segreto in pulizie.secret: mail_url, mail_secret)
create or replace function pulizie.send_pin(p_person text, p_email text, p_pin text) returns boolean language plpgsql security definer set search_path = pulizie, public, extensions as $$
declare u text := (select v from pulizie.secret where k = 'mail_url');
begin
  if u is null or u = '' then return false; end if;
  perform net.http_post(url := u, headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('secret', (select v from pulizie.secret where k = 'mail_secret'), 'to', p_email, 'name', p_person, 'pin', p_pin,
      'link', 'https://andreadamo.github.io/effestudio-hub/?app=pulizie'), timeout_milliseconds := 20000);
  return true;
end $$;
revoke all on function pulizie.send_pin(text,text,text) from public, anon, authenticated;

create or replace function pulizie.set_pin(p_person text, p_email text) returns text language plpgsql security definer set search_path = pulizie, extensions as $$
declare np text := lpad((floor(random()*10000))::int::text, 4, '0');
begin
  insert into pulizie.persona_pin(person, pin_hash, email) values (p_person, crypt(np, gen_salt('bf')), p_email)
  on conflict (person) do update set pin_hash = excluded.pin_hash, email = coalesce(excluded.email, pulizie.persona_pin.email), updated_at = now();
  return np;
end $$;
revoke all on function pulizie.set_pin(text,text) from public, anon, authenticated;

create or replace function pulizie.mask(e text) returns text language sql immutable as $$
  select left(split_part(e,'@',1),2) || '•••@' || split_part(e,'@',2)
$$;

-- staff: primo accesso (nome + email) → richiesta da approvare; se l'email è già quella registrata, nuovo PIN subito
create or replace function public.pul_register(p_person text, p_email text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare e text := lower(trim(p_email)); known text; np text;
begin
  if not exists (select 1 from pulizie.config c, jsonb_array_elements(c.data->'people') p where p->>'name' = p_person) then raise exception 'Nome non in elenco'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 120 then raise exception 'Email non valida'; end if;
  if (select count(*) from pulizie.richiesta where person = p_person and created_at > now() - interval '1 day') >= 3 then raise exception 'Troppe richieste oggi: chiedi all''amministrazione'; end if;
  select email into known from pulizie.persona_pin where person = p_person;
  if known is not null and known = e then
    if exists (select 1 from pulizie.reset_try where person = p_person and ts > now() - interval '10 minutes') then raise exception 'PIN appena inviato: controlla la tua email'; end if;
    insert into pulizie.reset_try(person) values (p_person);
    np := pulizie.set_pin(p_person, e);
    perform pulizie.send_pin(p_person, e, np);
    return jsonb_build_object('stato','inviato','email',pulizie.mask(e));
  end if;
  update pulizie.richiesta set stato = 'rifiutata' where person = p_person and stato = 'attesa';
  insert into pulizie.richiesta(person, email) values (p_person, e);
  return jsonb_build_object('stato','attesa');
end $$;

-- staff: PIN dimenticato → nuovo PIN all'email registrata (i telefoni già collegati restano collegati)
create or replace function public.pul_forgot(p_person text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare e text; np text;
begin
  select email into e from pulizie.persona_pin where person = p_person;
  if e is null then return jsonb_build_object('stato','nessuna_email'); end if;
  if exists (select 1 from pulizie.reset_try where person = p_person and ts > now() - interval '10 minutes') then raise exception 'PIN appena inviato: controlla la tua email (anche lo spam)'; end if;
  insert into pulizie.reset_try(person) values (p_person);
  delete from pulizie.reset_try where ts < now() - interval '1 day';
  np := pulizie.set_pin(p_person, null);
  perform pulizie.send_pin(p_person, e, np);
  return jsonb_build_object('stato','inviato','email',pulizie.mask(e));
end $$;

-- amministrazione
create or replace function public.pul_admin_people(p_pin text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  return jsonb_build_object(
    'pins', coalesce((select jsonb_agg(jsonb_build_object('person',person,'email',email,'updated',to_char(updated_at at time zone 'Europe/Rome','DD/MM/YYYY'))) from pulizie.persona_pin), '[]'::jsonb),
    'richieste', coalesce((select jsonb_agg(jsonb_build_object('id',id,'person',person,'email',email,'quando',to_char(created_at at time zone 'Europe/Rome','DD/MM HH24:MI')) order by created_at) from pulizie.richiesta where stato = 'attesa'), '[]'::jsonb),
    'mail', exists (select 1 from pulizie.secret where k = 'mail_url' and v <> ''));
end $$;

create or replace function public.pul_admin_approve(p_pin text, p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare r record; np text; sent boolean;
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  select * into r from pulizie.richiesta where id = p_id and stato = 'attesa';
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  update pulizie.richiesta set stato = case when p_ok then 'approvata' else 'rifiutata' end where id = p_id;
  if not p_ok then return jsonb_build_object('stato','rifiutata'); end if;
  np := pulizie.set_pin(r.person, r.email);
  update pulizie.persona_pin set email = r.email where person = r.person;
  delete from pulizie.sessione where person = r.person;
  sent := pulizie.send_pin(r.person, r.email, np);
  return jsonb_build_object('stato','approvata','pin',np,'email',r.email,'inviata',sent);
end $$;

drop function if exists public.pul_admin_new_pin(text,text);
create or replace function public.pul_admin_new_pin(p_pin text, p_person text) returns jsonb language plpgsql security definer set search_path = pulizie as $$
declare np text; e text; sent boolean := false;
begin
  if not pulizie.is_admin(p_pin) then raise exception 'PIN non valido'; end if;
  np := pulizie.set_pin(p_person, null);
  delete from pulizie.sessione where person = p_person;
  select email into e from pulizie.persona_pin where person = p_person;
  if e is not null then sent := pulizie.send_pin(p_person, e, np); end if;
  return jsonb_build_object('pin',np,'email',e,'inviata',sent);
end $$;

revoke all on function public.pul_register(text,text), public.pul_forgot(text), public.pul_admin_people(text), public.pul_admin_approve(text,bigint,boolean), public.pul_admin_new_pin(text,text) from public;
grant execute on function public.pul_register(text,text), public.pul_forgot(text), public.pul_admin_people(text), public.pul_admin_approve(text,bigint,boolean), public.pul_admin_new_pin(text,text) to anon, authenticated;
