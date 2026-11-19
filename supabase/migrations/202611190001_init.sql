-- Family Finance MVP. Run this in a NEW Supabase project.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Pengguna',
 created_at timestamptz not null default now()
);
create table public.households (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 80),
 invite_code text not null unique default encode(gen_random_bytes(20),'hex'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.household_members (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','member')),
 joined_at timestamptz not null default now(),
 primary key (household_id,user_id),
 unique (user_id)
);
create index household_members_user_idx on public.household_members(user_id);
create table public.accounts (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 name text not null check (char_length(name) between 1 and 80),
 visibility text not null check (visibility in ('shared','private')),
 opening_balance numeric(18,2) not null default 0,
 created_at timestamptz not null default now()
);
create index accounts_household_idx on public.accounts(household_id);
create table public.transactions (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 account_id uuid not null references public.accounts(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 kind text not null check (kind in ('income','expense')),
 amount numeric(18,2) not null check (amount > 0),
 category text not null check (char_length(category) between 1 and 80),
 note text not null default '',
 occurred_on date not null default current_date,
 created_at timestamptz not null default now()
);
create index transactions_household_date_idx on public.transactions(household_id,occurred_on desc);
create index transactions_account_idx on public.transactions(account_id);

-- Keep one user's profile automatically, even when email confirmation is enabled.
create function private.new_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id, coalesce(nullif(left(new.raw_user_meta_data->>'display_name',80),''),'Pengguna'));
 return new;
end; $$;
create trigger user_profile_on_signup after insert on auth.users for each row execute function private.new_user_profile();

-- SECURITY DEFINER helpers run with fixed search_path and take caller identity from auth.uid().
create function private.is_household_member(h uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.household_members m where m.household_id=h and m.user_id=(select auth.uid()));
$$;
create function private.can_access_account(a uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.accounts ac join public.household_members m on m.household_id=ac.household_id
  where ac.id=a and m.user_id=(select auth.uid()) and (ac.visibility='shared' or ac.owner_id=(select auth.uid()))
 );
$$;
create function private.account_matches_household(a uuid,h uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.accounts where id=a and household_id=h);
$$;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public;
grant execute on function private.is_household_member(uuid),private.can_access_account(uuid),private.account_matches_household(uuid,uuid) to authenticated;

-- Public exposed RPCs only for household creation/joining. Each validates auth.uid.
create function public.create_household(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'Already joined a household'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Invalid household name'; end if;
 insert into public.households(name,created_by) values(btrim(p_name),auth.uid()) returning id into v_id;
 insert into public.household_members(household_id,user_id,role) values(v_id,auth.uid(),'owner');
 return v_id;
end; $$;
create function public.join_household(p_invite_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'Already joined a household'; end if;
 select h.id into v_id from public.households h where h.invite_code = lower(btrim(coalesce(p_invite_code,''))) for update;
 if v_id is null then raise exception 'Invalid invite code'; end if;
 if (select count(*) from public.household_members where household_id=v_id) >= 2 then raise exception 'Household already has two members'; end if;
 insert into public.household_members(household_id,user_id,role) values(v_id,auth.uid(),'member');
 return v_id;
end; $$;
revoke execute on function public.create_household(text),public.join_household(text) from public,anon;
grant execute on function public.create_household(text),public.join_household(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
revoke all on public.profiles,public.households,public.household_members,public.accounts,public.transactions from anon,authenticated;
grant select,update(display_name) on public.profiles to authenticated;
grant select on public.households,public.household_members to authenticated;
grant select,insert,update(name,visibility,opening_balance),delete on public.accounts to authenticated;
grant select,insert,update(kind,amount,category,note,occurred_on,account_id),delete on public.transactions to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy households_read_members on public.households for select to authenticated using ((select private.is_household_member(id)));
create policy members_read_self on public.household_members for select to authenticated using (user_id=(select auth.uid()));
create policy accounts_read_visible on public.accounts for select to authenticated using ((select private.is_household_member(household_id)) and (visibility='shared' or owner_id=(select auth.uid())));
create policy accounts_insert_own on public.accounts for insert to authenticated with check ((select private.is_household_member(household_id)) and owner_id=(select auth.uid()));
create policy accounts_update_own on public.accounts for update to authenticated using (owner_id=(select auth.uid()) and (select private.is_household_member(household_id))) with check (owner_id=(select auth.uid()) and (select private.is_household_member(household_id)));
create policy accounts_delete_own on public.accounts for delete to authenticated using (owner_id=(select auth.uid()) and (select private.is_household_member(household_id)));
create policy tx_read_visible on public.transactions for select to authenticated using ((select private.is_household_member(household_id)) and (select private.can_access_account(account_id)));
create policy tx_insert_own on public.transactions for insert to authenticated with check (created_by=(select auth.uid()) and (select private.is_household_member(household_id)) and (select private.can_access_account(account_id)) and (select private.account_matches_household(account_id,household_id)));
create policy tx_update_own on public.transactions for update to authenticated using (created_by=(select auth.uid()) and (select private.can_access_account(account_id))) with check (created_by=(select auth.uid()) and (select private.can_access_account(account_id)) and (select private.account_matches_household(account_id,household_id)));
create policy tx_delete_own on public.transactions for delete to authenticated using (created_by=(select auth.uid()) and (select private.can_access_account(account_id)));

-- Protect transaction history from accidental account cascade-delete and
-- prevent making shared transactions written by the spouse inaccessible.
create function private.guard_account_change() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'DELETE' then
   if exists(select 1 from public.transactions t where t.account_id=old.id) then
     raise exception 'Cannot delete an account with transaction history';
   end if;
   return old;
 end if;
 if old.visibility = 'shared' and new.visibility = 'private' and exists (
   select 1 from public.transactions t where t.account_id=old.id and t.created_by <> old.owner_id
 ) then
   raise exception 'Cannot privatize an account with transactions from another member';
 end if;
 return new;
end; $$;
create trigger guard_account_change before update or delete on public.accounts
for each row execute function private.guard_account_change();
revoke execute on function private.guard_account_change() from public;

-- Realtime Postgres Changes for visible account and transaction changes.
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
