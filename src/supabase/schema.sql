-- =====================================================================
-- Don Macchiatos Loyalty: Phase 3 database (Supabase / Postgres)
-- Run this whole file once in: Supabase dashboard > SQL Editor > New query.
-- It is safe to re-run, also if you already ran the Phase 3A version: it only
-- adds what is missing (tables IF NOT EXISTS, columns ADD IF NOT EXISTS,
-- functions CREATE OR REPLACE).
--
-- SECURITY MODEL
--  * Every table has Row Level Security ON and NO public policies, and all
--    table privileges are revoked from the browser roles (anon/authenticated).
--    The browser can NOT read or write tables directly.
--  * The browser only calls the functions below (supabase.rpc). They run on
--    the server side of Postgres, validate every input, and decide the result.
--  * Customers (no login) may call: get_card, enroll_customer, redeem_code.
--  * Staff (Supabase Auth login AND listed in the `staff` table) may also call:
--    issue_code, give_reward. The staff check happens inside the function.
--  * Stamp counts are never sent by the client; they are counted from the
--    `purchases` table.
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.drinks (
  id    text primary key,
  name  text not null,
  price numeric(8,2) not null default 39
);

-- Staff allowlist. Being able to log in is NOT enough: the user must be here.
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default '' check (char_length(name) <= 40),
  mobile_number text not null unique check (mobile_number ~ '^09[0-9]{9}$'),
  created_at    timestamptz not null default now()
);
-- Phase 3 additions. current_stamps / completed_cards are written ONLY by
-- redeem_code (inside the same transaction as the purchase), never by the browser.
-- current_stamps: 0..10 on the card in progress (10 = card complete, free drink earned).
alter table public.customers add column if not exists current_stamps  int not null default 0;
alter table public.customers add column if not exists completed_cards int not null default 0;
alter table public.customers add column if not exists is_demo         boolean not null default false;
do $$ begin
  alter table public.customers add constraint customers_stamps_range check (current_stamps between 0 and 10);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.customers add constraint customers_completed_nonneg check (completed_cards >= 0);
exception when duplicate_object then null; end $$;

-- One row per purchase code staff issue. sale_token makes "Show same code"
-- repeatable: the same sale always returns the same code.
create table if not exists public.purchase_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (code ~ '^[0-9]{4}$'),
  drink_id    text not null references public.drinks(id),
  sale_token  uuid not null unique,
  status      text not null default 'issued' check (status in ('issued', 'redeemed', 'expired')),
  issued_by   uuid references auth.users(id),
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  redeemed_at timestamptz
);
-- A code value can exist only once among codes that can still be redeemed.
create unique index if not exists purchase_codes_one_active_code
  on public.purchase_codes (code) where status = 'issued';
-- Phase 3 additions (issued_at is this table's "created_at").
alter table public.purchase_codes add column if not exists drink_name text;
alter table public.purchase_codes add column if not exists redeemed_by_customer_id uuid
  references public.customers(id) on delete set null;
alter table public.purchase_codes add column if not exists is_demo boolean not null default false;

-- One row per redeemed code = one stamp. code_id is UNIQUE: a code can never
-- produce two stamps, even if two requests arrive at the same instant.
create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id),
  drink_id      text not null references public.drinks(id),
  drink_name    text not null,
  code_id       uuid not null unique references public.purchase_codes(id),
  purchase_code text not null,
  purchased_at  timestamptz not null,
  redeemed_at   timestamptz not null default now()
);
create index if not exists purchases_customer_idx on public.purchases (customer_id);
alter table public.purchases add column if not exists is_demo boolean not null default false;

create table if not exists public.rewards (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id),
  card_number   int  not null,
  reward_status text not null default 'earned' check (reward_status in ('earned', 'redeemed')),
  earned_at     timestamptz not null default now(),
  redeemed_at   timestamptz,
  given_by      uuid references auth.users(id),
  unique (customer_id, card_number)
);

-- Failed redeem attempts, used to slow down code guessing.
create table if not exists public.redeem_attempts (
  id            bigserial primary key,
  mobile_number text not null,
  attempted_at  timestamptz not null default now()
);
create index if not exists redeem_attempts_recent_idx on public.redeem_attempts (mobile_number, attempted_at);

-- Backfill the stored stamp columns for customers created by the Phase 3A version.
update public.customers c set
  current_stamps  = case when n.total = 0 then 0 else ((n.total - 1) % 10) + 1 end,
  completed_cards = n.total / 10
from (select cu.id, (select count(*) from public.purchases p where p.customer_id = cu.id)::int as total
      from public.customers cu) n
where c.id = n.id;

-- ---------- Lock the tables down ----------

alter table public.drinks          enable row level security;
alter table public.staff           enable row level security;
alter table public.customers       enable row level security;
alter table public.purchase_codes  enable row level security;
alter table public.purchases       enable row level security;
alter table public.rewards         enable row level security;
alter table public.redeem_attempts enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------- Menu data (matches src/data/menu.js: all drinks cost 39) ----------

insert into public.drinks (id, name, price) values
  ('iced-caramel-macchiato', 'Iced Caramel Macchiato', 39),
  ('spanish-latte',          'Spanish Latte',          39),
  ('don-pistachio',          'Don Pistachio',          39),
  ('donya-berry',            'Donya Berry',            39),
  ('don-matchatos',          'Don Matchatos',          39),
  ('matcha-berry',           'Matcha Berry',           39),
  ('oreo-coffee',            'Oreo Coffee',            39),
  ('don-darko',              'Don Darko',              39),
  ('black-forest',           'Black Forest',           39),
  ('hot-caramel',            'Hot Caramel',            39),
  ('hot-darko',              'Hot Darko',              39),
  ('don-barako',             'Don Barako',             39)
on conflict (id) do update set name = excluded.name, price = excluded.price;

-- ---------- Helpers (internal, not callable from the browser) ----------

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Same rules as normalizeMobile() in src/logic/loyalty.js.
create or replace function public.normalize_mobile(p_raw text)
returns text
language plpgsql immutable
as $$
declare
  v text := regexp_replace(coalesce(p_raw, ''), '[\s()-]', '', 'g');
begin
  if v ~ '^\+?63(9[0-9]{9})$' then
    v := '0' || substring(v from '(9[0-9]{9})$');
  end if;
  return v;
end;
$$;

-- Everything the loyalty card needs, shaped like the Phase 2 frontend state.
create or replace function public._card_json(p_customer_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'customer', (
      select jsonb_build_object('id', c.id, 'name', c.name,
                                'mobile_number', c.mobile_number, 'created_at', c.created_at,
                                'is_demo', c.is_demo)
      from public.customers c where c.id = p_customer_id),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'customer_id', p.customer_id, 'drink_id', p.drink_id,
               'drink_name', p.drink_name, 'purchase_code', p.purchase_code,
               'purchased_at', p.purchased_at, 'redeemed_at', p.redeemed_at)
             order by p.purchased_at desc)
      from public.purchases p where p.customer_id = p_customer_id), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'customer_id', r.customer_id, 'card_number', r.card_number,
               'reward_status', r.reward_status, 'earned_at', r.earned_at,
               'redeemed_at', r.redeemed_at)
             order by r.card_number)
      from public.rewards r where r.customer_id = p_customer_id), '[]'::jsonb)
  );
$$;

-- ---------- Customer functions (no login needed) ----------

create or replace function public.get_card(p_mobile text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  m text := public.normalize_mobile(p_mobile);
  cid uuid;
begin
  if m = '' then
    return jsonb_build_object('ok', false, 'code', 'empty', 'message', 'Enter your mobile number.');
  end if;
  if m !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid',
      'message', 'Enter an 11-digit mobile number that starts with 09.');
  end if;
  select id into cid from public.customers where mobile_number = m;
  if cid is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'mobile', m,
      'message', 'No card found for that number yet.');
  end if;
  return public._card_json(cid);
end;
$$;

create or replace function public.enroll_customer(p_mobile text, p_name text default '')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  m text := public.normalize_mobile(p_mobile);
  clean_name text := left(btrim(regexp_replace(
    regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g'), '\s+', ' ', 'g')), 40);
  cid uuid;
begin
  if m = '' then
    return jsonb_build_object('ok', false, 'code', 'empty', 'message', 'Enter your mobile number.');
  end if;
  if m !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid',
      'message', 'Enter an 11-digit mobile number that starts with 09.');
  end if;
  begin
    -- Numbers 09000000000-09000000999 are reserved for testing and are flagged as demo records.
    insert into public.customers (name, mobile_number, is_demo)
      values (clean_name, m, m ~ '^09000000[0-9]{3}$') returning id into cid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate',
      'message', 'A card already exists for that number. Load it instead.');
  end;
  return public._card_json(cid);
end;
$$;

-- Verifies the code, records the purchase and awards exactly one stamp.
-- Everything happens in ONE transaction; the code row is locked first, so two
-- simultaneous attempts with the same code cannot both succeed.
create or replace function public.redeem_code(p_mobile text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  m          text := public.normalize_mobile(p_mobile);
  c          text := btrim(coalesce(p_code, ''));
  cust       public.customers%rowtype;
  pc         public.purchase_codes%rowtype;
  dname      text;
  total      int;
  reward_new boolean := false;
begin
  if m !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'no_customer', 'message', 'Load your loyalty card first.');
  end if;
  if c = '' then
    return jsonb_build_object('ok', false, 'code', 'empty', 'message', 'Enter the code from staff.');
  end if;
  if c !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'That code isn''t valid.');
  end if;

  -- Rate limit guessing: 5 failures per number / 60 failures overall per 10 minutes.
  if (select count(*) from public.redeem_attempts
        where mobile_number = m and attempted_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.redeem_attempts
        where attempted_at > now() - interval '10 minutes') >= 60 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited',
      'message', 'Too many wrong codes. Please wait a few minutes and ask staff for help.');
  end if;

  -- Locking the customer row also keeps their stamp count and rewards consistent.
  select * into cust from public.customers where mobile_number = m for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_customer', 'message', 'Load your loyalty card first.');
  end if;

  select * into pc from public.purchase_codes
    where code = c and status = 'issued' for update;

  if not found then
    insert into public.redeem_attempts (mobile_number) values (m);
    if exists (select 1 from public.purchase_codes where code = c and status = 'redeemed') then
      return jsonb_build_object('ok', false, 'code', 'used', 'message', 'That code has already been used.');
    end if;
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'That code isn''t valid.');
  end if;

  if pc.expires_at <= now() then
    update public.purchase_codes set status = 'expired' where id = pc.id;
    insert into public.redeem_attempts (mobile_number) values (m);
    return jsonb_build_object('ok', false, 'code', 'expired',
      'message', 'That code has expired. Ask staff for a new one.');
  end if;

  select name into dname from public.drinks where id = pc.drink_id;

  insert into public.purchases (customer_id, drink_id, drink_name, code_id, purchase_code, purchased_at, is_demo)
    values (cust.id, pc.drink_id, dname, pc.id, pc.code, pc.issued_at, cust.is_demo);
  update public.purchase_codes
    set status = 'redeemed', redeemed_at = now(), redeemed_by_customer_id = cust.id
    where id = pc.id;

  select count(*) into total from public.purchases where customer_id = cust.id;
  update public.customers
    set current_stamps = ((total - 1) % 10) + 1, completed_cards = total / 10
    where id = cust.id;
  if total % 10 = 0 then
    insert into public.rewards (customer_id, card_number) values (cust.id, total / 10)
      on conflict (customer_id, card_number) do nothing;
    reward_new := true;
  end if;

  return public._card_json(cust.id)
    || jsonb_build_object('drink_name', dname, 'reward_earned', reward_new);
end;
$$;

-- ---------- Staff functions (login + staff allowlist required) ----------

-- Issues the code for ONE sale. The browser makes a fresh random sale_token when
-- staff press "Start next purchase". Calling again with the same sale_token
-- ("Show same code") returns the SAME code and never generates another.
create or replace function public.issue_code(p_drink_id text, p_sale_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  existing public.purchase_codes%rowtype;
  d        public.drinks%rowtype;
  new_code text;
  tries    int := 0;
begin
  if not public.is_staff() then
    raise exception 'Staff access only' using errcode = '42501';
  end if;
  if p_sale_token is null then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Missing sale.');
  end if;

  select * into d from public.drinks where id = p_drink_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_drink', 'message', 'Choose a drink from the menu.');
  end if;

  -- Free up codes that expired without being used.
  update public.purchase_codes set status = 'expired'
    where status = 'issued' and expires_at <= now();

  loop
    select * into existing from public.purchase_codes where sale_token = p_sale_token;
    if found then
      return jsonb_build_object('ok', true, 'code', existing.code, 'drink_id', existing.drink_id,
        'drink_name', (select name from public.drinks where id = existing.drink_id),
        'status', existing.status, 'issued_at', existing.issued_at,
        'expires_at', existing.expires_at, 'reused', true);
    end if;

    tries := tries + 1;
    if tries > 50 then
      return jsonb_build_object('ok', false, 'code', 'busy', 'message', 'Could not make a code. Try again.');
    end if;

    -- 4 digits from gen_random_uuid(), which Postgres fills from a cryptographic random source.
    new_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0');
    begin
      insert into public.purchase_codes (code, drink_id, drink_name, sale_token, issued_by, expires_at)
        values (new_code, d.id, d.name, p_sale_token, auth.uid(), now() + interval '15 minutes');
      return jsonb_build_object('ok', true, 'code', new_code, 'drink_id', d.id, 'drink_name', d.name,
        'status', 'issued', 'issued_at', now(), 'expires_at', now() + interval '15 minutes', 'reused', false);
    exception when unique_violation then
      null; -- code value already active, or a double-click raced us: loop and retry
    end;
  end loop;
end;
$$;

-- Marks the customer's oldest waiting free drink as given.
create or replace function public.give_reward(p_mobile text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  m   text := public.normalize_mobile(p_mobile);
  cid uuid;
  rid uuid;
begin
  if not public.is_staff() then
    raise exception 'Staff access only' using errcode = '42501';
  end if;
  select id into cid from public.customers where mobile_number = m;
  if cid is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No card found for that number yet.');
  end if;
  select id into rid from public.rewards
    where customer_id = cid and reward_status = 'earned'
    order by card_number limit 1 for update;
  if rid is null then
    return jsonb_build_object('ok', false, 'code', 'none', 'message', 'No free drink is waiting for this customer.');
  end if;
  update public.rewards set reward_status = 'redeemed', redeemed_at = now(), given_by = auth.uid()
    where id = rid;
  return jsonb_build_object('ok', true);
end;
$$;

-- Read-only: lets staff restore the code of the sale in progress after a page reload.
-- It NEVER creates a code.
create or replace function public.get_sale_code(p_sale_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pc public.purchase_codes%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access only' using errcode = '42501';
  end if;
  select * into pc from public.purchase_codes where sale_token = p_sale_token;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No code for this sale.');
  end if;
  if pc.status = 'issued' and pc.expires_at <= now() then
    update public.purchase_codes set status = 'expired' where id = pc.id;
    pc.status := 'expired';
  end if;
  return jsonb_build_object('ok', true, 'code', pc.code, 'drink_id', pc.drink_id,
    'drink_name', pc.drink_name, 'status', pc.status, 'issued_at', pc.issued_at,
    'expires_at', pc.expires_at, 'reused', true);
end;
$$;

-- ---------- Connection check + sign-in role check ----------

-- A real round trip to the database, used by the green/red dot in the footer.
create or replace function public.ping()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('ok', true, 'time', now(),
                            'drinks', (select count(*) from public.drinks));
$$;

-- Lets the staff screen know whether the signed-in user is on the staff list.
create or replace function public.staff_check()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('ok', true, 'is_staff', public.is_staff());
$$;

-- ---------- Demo / test data (staff only, clearly flagged is_demo) ----------
-- Demo customers use the reserved numbers 09000000001-09000000003 and are marked
-- is_demo = true everywhere. Real customers are never touched.

create or replace function public._remove_demo()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  n_cust int; n_pur int;
begin
  delete from public.rewards   where customer_id in (select id from public.customers where is_demo);
  delete from public.purchases where is_demo or customer_id in (select id from public.customers where is_demo);
  delete from public.purchase_codes where is_demo;
  delete from public.customers where is_demo;
  get diagnostics n_cust = row_count;
  return jsonb_build_object('ok', true, 'customers_removed', n_cust);
end;
$$;

create or replace function public.create_demo_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  spec     text[][] := array[['09000000001','Demo Empty Card','0'],
                             ['09000000002','Demo Three Cups','3'],
                             ['09000000003','Demo Nine Cups','9']];
  drinks_  text[] := array['iced-caramel-macchiato','spanish-latte','don-pistachio','oreo-coffee','hot-caramel'];
  i int; j int; n int; cid uuid; pcid uuid; did text; dn text;
begin
  if not public.is_staff() then
    raise exception 'Staff access only' using errcode = '42501';
  end if;
  if exists (select 1 from public.customers
             where not is_demo and mobile_number in ('09000000001','09000000002','09000000003')) then
    return jsonb_build_object('ok', false, 'code', 'reserved',
      'message', 'A real customer already uses a demo number. Nothing was changed.');
  end if;

  perform public._remove_demo();

  for i in 1 .. array_length(spec, 1) loop
    n := spec[i][3]::int;
    insert into public.customers (name, mobile_number, is_demo, current_stamps, completed_cards)
      values (spec[i][2], spec[i][1], true, n, 0) returning id into cid;
    for j in 1 .. n loop
      did := drinks_[((j - 1) % array_length(drinks_, 1)) + 1];
      select name into dn from public.drinks where id = did;
      insert into public.purchase_codes (code, drink_id, drink_name, sale_token, status, issued_by,
                                         issued_at, expires_at, redeemed_at, redeemed_by_customer_id, is_demo)
        values ('0000', did, dn, gen_random_uuid(), 'redeemed', auth.uid(),
                now() - (n - j + 1) * interval '1 day', now() - (n - j + 1) * interval '1 day',
                now() - (n - j + 1) * interval '1 day', cid, true)
        returning id into pcid;
      insert into public.purchases (customer_id, drink_id, drink_name, code_id, purchase_code,
                                    purchased_at, redeemed_at, is_demo)
        values (cid, did, dn, pcid, '0000', now() - (n - j + 1) * interval '1 day',
                now() - (n - j + 1) * interval '1 day', true);
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'numbers', jsonb_build_array('09000000001','09000000002','09000000003'));
end;
$$;

create or replace function public.remove_demo_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access only' using errcode = '42501';
  end if;
  return public._remove_demo();
end;
$$;

-- ---------- Who may call what ----------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_card(text)                to anon, authenticated;
grant execute on function public.enroll_customer(text, text)   to anon, authenticated;
grant execute on function public.redeem_code(text, text)       to anon, authenticated;
grant execute on function public.issue_code(text, uuid)        to authenticated;  -- also checks is_staff()
grant execute on function public.give_reward(text)             to authenticated;  -- also checks is_staff()
grant execute on function public.get_sale_code(uuid)           to authenticated;  -- also checks is_staff()
grant execute on function public.create_demo_data()            to authenticated;  -- also checks is_staff()
grant execute on function public.remove_demo_data()            to authenticated;  -- also checks is_staff()
grant execute on function public.ping()                        to anon, authenticated;
grant execute on function public.staff_check()                 to anon, authenticated;
