-- Budget 2027 (per bulan) — draf awal dari data Agu–Nov 2026 kamu dan suami.
-- Pemasukan rumah tangga: Rp19.600.000 (Rp11.600.000 + Rp8.000.000).
-- Jalankan SETELAH migration v3 dan setelah ruang keluarga dibuat di aplikasi.
-- Aman dijalankan ulang: angka yang sudah ada akan ditimpa dengan angka di bawah.
insert into public.budgets (household_id, year, category, subcategory, monthly_amount, note, updated_by)
select h.id, 2027, b.category, b.subcategory, b.amount, b.note, h.created_by
from public.households h
cross join (values
  ('Kebutuhan', 'Makan',                 2800000, 'Makan di luar + belanja dapur berdua'),
  ('Kebutuhan', 'Transport',             1900000, 'Flazz/e-toll, ojol, parkir, bensin'),
  ('Kebutuhan', 'Home',                  1750000, 'BPJS, listrik, internet, kebutuhan rumah'),
  ('Kebutuhan', 'Kesehatan',              350000, 'Kontrol behel, obat'),
  ('Kebutuhan', 'Bodycare and Skincare',  350000, 'Skincare, cukur'),
  ('Kebutuhan', 'Biaya Transaksi',         25000, 'Fee broker/transfer'),
  ('Keinginan', 'JAJAN',                  900000, 'Kopi & jajan — turun ~10% dari kebiasaan'),
  ('Keinginan', 'GIFT',                   300000, 'Kado & kondangan'),
  ('Keinginan', 'Hobby',                  400000, 'Biaya race/lari'),
  ('Keinginan', 'Online Subscription',    100000, ''),
  ('Keinginan', 'others',                 500000, 'Fashion, servis barang, lain-lain'),
  ('Tabungan',  '',                     10225000, 'Dana Darurat 1,5 jt · Liburan 2,5 jt · Tanah/Rumah 5 jt · Investasi 1,225 jt')
) as b(category, subcategory, amount, note)
on conflict (household_id, year, category, subcategory)
do update set monthly_amount = excluded.monthly_amount, note = excluded.note, updated_at = now();
