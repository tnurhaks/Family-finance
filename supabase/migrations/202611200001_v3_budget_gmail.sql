-- Family Finance v3: taxonomy Budggt, transfer, budget, dan antrean Gmail.
-- Jalankan SEKALI di SQL Editor, SETELAH 202611190001_init.sql.
-- Aman untuk data v1/v2: kategori lama dipetakan ke taxonomy Budggt.

-- ---------------------------------------------------------------
-- 1. Transaksi: Kategori + Sub Kategori (Budggt), transfer, sumber
-- ---------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in ('income','expense','transfer'));
alter table public.transactions add column if not exists subcategory text not null default '';
alter table public.transactions add column if not exists to_account_id uuid references public.accounts(id);
alter table public.transactions add column if not exists source text not null default 'manual';
alter table public.transactions add column if not exists external_id text;
alter table public.transactions add constraint transactions_source_check check (source in ('manual','gmail','import'));
alter table public.transactions add constraint transactions_transfer_check check (kind = 'transfer' or to_account_id is null);
alter table public.transactions add constraint transactions_subcategory_len check (char_length(subcategory) <= 80);
create unique index if not exists transactions_external_uidx on public.transactions(household_id, external_id) where external_id is not null;
create index if not exists transactions_to_account_idx on public.transactions(to_account_id);

-- Petakan kategori lama (v1/v2) ke Kategori/Sub Kategori Budggt.
update public.transactions set subcategory = case category
    when 'Makan & Minum' then 'Makan' when 'Tempat Tinggal' then 'Home' when 'Tagihan' then 'Home'
    when 'Transportasi' then 'Transport' when 'Kesehatan' then 'Kesehatan'
    when 'Sosial & Keluarga' then 'GIFT' else 'others' end,
  category = case when category in ('Belanja & Gaya Hidup','Sosial & Keluarga','Lain-lain') then 'Keinginan' else 'Kebutuhan' end
where kind = 'expense' and category not in ('Kebutuhan','Keinginan','Tabungan');
update public.transactions set subcategory = case when category = 'Gaji' then 'Gaji' else 'Lainnya' end, category = 'Pemasukan'
where kind = 'income' and category <> 'Pemasukan';

-- Transfer: penerima harus rekening yang boleh diakses pembuat dan berada di keluarga yang sama.
create or replace function private.valid_transfer_target(t uuid, h uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select t is null or ((select private.can_access_account(t)) and (select private.account_matches_household(t, h)));
$$;
revoke execute on function private.valid_transfer_target(uuid,uuid) from public;
grant execute on function private.valid_transfer_target(uuid,uuid) to authenticated;

drop policy if exists tx_read_visible on public.transactions;
drop policy if exists tx_insert_own on public.transactions;
drop policy if exists tx_update_own on public.transactions;
-- Pasangan bisa melihat transfer MASUK ke rekening bersama walau sumbernya rekening pribadi.
create policy tx_read_visible on public.transactions for select to authenticated using (
  (select private.is_household_member(household_id)) and (
    (select private.can_access_account(account_id)) or (to_account_id is not null and (select private.can_access_account(to_account_id)))
  ));
create policy tx_insert_own on public.transactions for insert to authenticated with check (
  created_by = (select auth.uid()) and (select private.is_household_member(household_id))
  and (select private.can_access_account(account_id)) and (select private.account_matches_household(account_id, household_id))
  and (select private.valid_transfer_target(to_account_id, household_id)));
create policy tx_update_own on public.transactions for update to authenticated
  using (created_by = (select auth.uid()) and (select private.can_access_account(account_id)))
  with check (created_by = (select auth.uid()) and (select private.can_access_account(account_id))
    and (select private.account_matches_household(account_id, household_id))
    and (select private.valid_transfer_target(to_account_id, household_id)));

revoke update on public.transactions from authenticated;
grant insert (household_id, account_id, created_by, kind, amount, category, subcategory, note, occurred_on, to_account_id, source, external_id) on public.transactions to authenticated;
grant update (kind, amount, category, subcategory, note, occurred_on, account_id, to_account_id) on public.transactions to authenticated;

-- Rekening dengan transfer masuk juga punya histori -> tidak boleh dihapus.
create or replace function private.guard_account_change() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'DELETE' then
   if exists(select 1 from public.transactions t where t.account_id = old.id or t.to_account_id = old.id) then
     raise exception 'Cannot delete an account with transaction history';
   end if;
   return old;
 end if;
 if old.visibility = 'shared' and new.visibility = 'private' and exists (
   select 1 from public.transactions t where (t.account_id = old.id or t.to_account_id = old.id) and t.created_by <> old.owner_id
 ) then
   raise exception 'Cannot privatize an account with transactions from another member';
 end if;
 return new;
end; $$;

-- ---------------------------------------------------------------
-- 2. Profil pasangan terlihat + pilihan berbagi TOTAL kategori
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists share_totals boolean not null default false;
create or replace function private.shares_household(other uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members a join public.household_members b on a.household_id = b.household_id
                 where a.user_id = (select auth.uid()) and b.user_id = other);
$$;
revoke execute on function private.shares_household(uuid) from public;
grant execute on function private.shares_household(uuid) to authenticated;
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_household on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_household(id)));
drop policy if exists members_read_self on public.household_members;
create policy members_read_household on public.household_members for select to authenticated
  using ((select private.is_household_member(household_id)));
grant update (share_totals) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- 3. Budget bulanan per Kategori / Sub Kategori
-- ---------------------------------------------------------------
create table if not exists public.budgets (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 year int not null check (year between 2020 and 2100),
 category text not null check (category in ('Kebutuhan','Keinginan','Tabungan')),
 subcategory text not null default '' check (char_length(subcategory) <= 80),
 monthly_amount numeric(18,2) not null check (monthly_amount >= 0),
 note text not null default '' check (char_length(note) <= 300),
 updated_by uuid references auth.users(id) default auth.uid(),
 updated_at timestamptz not null default now(),
 unique (household_id, year, category, subcategory)
);
alter table public.budgets enable row level security;
revoke all on public.budgets from anon, authenticated;
grant select, insert, delete on public.budgets to authenticated;
grant update (monthly_amount, note, updated_by, updated_at) on public.budgets to authenticated;
create policy budgets_member_all on public.budgets for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

-- Total per bulan/kategori untuk budget. Rekening pribadi pasangan ikut dihitung HANYA jika
-- pemiliknya mengaktifkan "Bagikan total ke budget" (hanya angka total, bukan detail transaksi).
create or replace function public.household_totals(p_from date, p_to date)
returns table(month text, kind text, category text, subcategory text, total numeric)
language sql stable security definer set search_path = '' as $$
  select to_char(t.occurred_on, 'YYYY-MM'), t.kind, t.category, t.subcategory, sum(t.amount)
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.profiles p on p.id = a.owner_id
  where (select auth.uid()) is not null
    and t.household_id = (select m.household_id from public.household_members m where m.user_id = (select auth.uid()))
    and t.occurred_on between p_from and least(p_to, p_from + 400)
    and (a.visibility = 'shared' or a.owner_id = (select auth.uid()) or coalesce(p.share_totals, false))
  group by 1, 2, 3, 4;
$$;
revoke execute on function public.household_totals(date,date) from public, anon;
grant execute on function public.household_totals(date,date) to authenticated;

-- ---------------------------------------------------------------
-- 4. Gmail: antrean review + token pribadi untuk Apps Script
-- ---------------------------------------------------------------
create table if not exists public.inbox_items (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null check (char_length(external_id) <= 200),
 sender text not null default '', subject text not null default '', snippet text not null default '',
 kind text not null default 'expense' check (kind in ('income','expense','transfer')),
 amount numeric(18,2) check (amount is null or amount > 0),
 category text not null default '', subcategory text not null default '',
 account_hint text not null default '', merchant text not null default '', note text not null default '',
 occurred_on date not null default current_date,
 confidence text not null default 'low' check (confidence in ('high','low')),
 reason text not null default '',
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 transaction_id uuid references public.transactions(id) on delete set null,
 created_at timestamptz not null default now(),
 unique (user_id, external_id)
);
create index if not exists inbox_items_user_status_idx on public.inbox_items(user_id, status, occurred_on desc);
alter table public.inbox_items enable row level security;
revoke all on public.inbox_items from anon, authenticated;
grant select on public.inbox_items to authenticated;
grant update (status, transaction_id) on public.inbox_items to authenticated;
-- Email adalah milik pribadi: hanya pemilik Gmail yang melihat antreannya.
create policy inbox_owner_read on public.inbox_items for select to authenticated using (user_id = (select auth.uid()));
create policy inbox_owner_update on public.inbox_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists private.ingest_tokens (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade,
 token_hash text not null unique,
 created_at timestamptz not null default now(),
 last_used_at timestamptz,
 revoked_at timestamptz
);
alter table private.ingest_tokens enable row level security;
revoke all on private.ingest_tokens from public, anon, authenticated;

-- Membuat token baru (token lama otomatis dicabut). Token asli hanya tampil sekali.
create or replace function public.create_ingest_token() returns text language plpgsql security definer set search_path = '' as $$
declare v_h uuid; v_token text;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select household_id into v_h from public.household_members where user_id = auth.uid();
 if v_h is null then raise exception 'Join a household first'; end if;
 update private.ingest_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
 v_token := 'ffg_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
 insert into private.ingest_tokens(user_id, household_id, token_hash)
   values (auth.uid(), v_h, encode(pg_catalog.sha256(convert_to(v_token, 'UTF8')), 'hex'));
 return v_token;
end; $$;
create or replace function public.revoke_ingest_token() returns void language sql security definer set search_path = '' as $$
  update private.ingest_tokens set revoked_at = now() where user_id = (select auth.uid()) and revoked_at is null;
$$;
create or replace function public.ingest_token_status() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('active', true, 'created_at', created_at, 'last_used_at', last_used_at)
    from private.ingest_tokens where user_id = (select auth.uid()) and revoked_at is null order by created_at desc limit 1),
    jsonb_build_object('active', false));
$$;
revoke execute on function public.create_ingest_token(), public.revoke_ingest_token(), public.ingest_token_status() from public, anon;
grant execute on function public.create_ingest_token(), public.revoke_ingest_token(), public.ingest_token_status() to authenticated;

-- Dipanggil Google Apps Script. Autentikasi memakai token pribadi (bukan login).
-- confidence = 'high' + rekening cocok -> langsung jadi transaksi (Auto Mode).
-- Selain itu -> masuk antrean "Perlu review".
create or replace function public.ingest_gmail(p_token text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 v_tok private.ingest_tokens%rowtype; v_item jsonb; v_inbox uuid; v_acc uuid; v_tx uuid;
 v_kind text; v_amount numeric; v_date date; v_conf text;
 n_new int := 0; n_auto int := 0; n_dup int := 0;
begin
 select * into v_tok from private.ingest_tokens
  where token_hash = encode(pg_catalog.sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and revoked_at is null;
 if not found then raise exception 'Invalid token'; end if;
 if not exists (select 1 from public.household_members where user_id = v_tok.user_id and household_id = v_tok.household_id) then
   raise exception 'Not a household member';
 end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 200 then raise exception 'Invalid payload'; end if;

 for v_item in select value from jsonb_array_elements(p_items) loop
   v_inbox := null; v_acc := null; v_tx := null;
   v_kind := case when v_item->>'kind' in ('income','expense','transfer') then v_item->>'kind' else 'expense' end;
   v_amount := case when (v_item->>'amount') ~ '^[0-9]+(\.[0-9]{1,2})?$' and (v_item->>'amount')::numeric > 0 then (v_item->>'amount')::numeric end;
   begin
     v_date := case when (v_item->>'occurred_on') ~ '^\d{4}-\d{2}-\d{2}$' then (v_item->>'occurred_on')::date else current_date end;
   exception when others then v_date := current_date;
   end;
   v_conf := case when v_item->>'confidence' = 'high' and v_amount is not null then 'high' else 'low' end;
   if coalesce(v_item->>'external_id', '') = '' then continue; end if;

   insert into public.inbox_items(household_id, user_id, external_id, sender, subject, snippet, kind, amount, category, subcategory,
     account_hint, merchant, note, occurred_on, confidence, reason)
   values (v_tok.household_id, v_tok.user_id, left(v_item->>'external_id', 200), left(coalesce(v_item->>'sender', ''), 200),
     left(coalesce(v_item->>'subject', ''), 300), left(coalesce(v_item->>'snippet', ''), 600), v_kind, v_amount,
     left(coalesce(v_item->>'category', ''), 80), left(coalesce(v_item->>'subcategory', ''), 80),
     left(coalesce(v_item->>'account_hint', ''), 80), left(coalesce(v_item->>'merchant', ''), 120),
     left(coalesce(v_item->>'note', ''), 500), v_date, v_conf, left(coalesce(v_item->>'reason', ''), 300))
   on conflict (user_id, external_id) do nothing
   returning id into v_inbox;

   if v_inbox is null then n_dup := n_dup + 1; continue; end if;
   n_new := n_new + 1;

   if v_conf = 'high' and v_kind in ('expense', 'income')
      and coalesce(v_item->>'category', '') in ('Kebutuhan', 'Keinginan', 'Tabungan', 'Pemasukan') then
     select id into v_acc from public.accounts
      where household_id = v_tok.household_id and owner_id = v_tok.user_id
        and upper(btrim(name)) = upper(btrim(coalesce(v_item->>'account_hint', '')))
      limit 1;
     if v_acc is not null then
       insert into public.transactions(household_id, account_id, created_by, kind, amount, category, subcategory, note, occurred_on, source, external_id)
       values (v_tok.household_id, v_acc, v_tok.user_id, v_kind, v_amount, v_item->>'category', left(coalesce(v_item->>'subcategory', ''), 80),
         left(coalesce(nullif(v_item->>'note', ''), v_item->>'merchant', ''), 500), v_date, 'gmail', left(v_item->>'external_id', 200))
       on conflict (household_id, external_id) where external_id is not null do nothing
       returning id into v_tx;
       if v_tx is not null then
         update public.inbox_items set status = 'approved', transaction_id = v_tx where id = v_inbox;
         n_auto := n_auto + 1;
       end if;
     end if;
   end if;
 end loop;

 update private.ingest_tokens set last_used_at = now() where id = v_tok.id;
 return jsonb_build_object('new', n_new, 'auto', n_auto, 'review', n_new - n_auto, 'duplicate', n_dup);
end; $$;
revoke execute on function public.ingest_gmail(text, jsonb) from public;
grant execute on function public.ingest_gmail(text, jsonb) to anon, authenticated;

-- Realtime untuk budget dan antrean review.
alter publication supabase_realtime add table public.budgets;
alter publication supabase_realtime add table public.inbox_items;
