-- RESET: hapus semua tabel & fungsi Family Finance supaya bisa install ulang dari awal.
-- HANYA untuk project yang BELUM berisi data penting.
drop trigger if exists user_profile_on_signup on auth.users;
drop table if exists public.inbox_items, public.budgets, public.transactions, public.accounts,
  public.household_members, public.households, public.profiles cascade;
drop function if exists public.create_household(text), public.join_household(text),
  public.household_totals(date,date), public.create_ingest_token(), public.revoke_ingest_token(),
  public.ingest_token_status(), public.ingest_gmail(text,jsonb);
drop schema if exists private cascade;
