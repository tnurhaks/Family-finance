// Taxonomy resmi keluarga = mengikuti file Budggt.
export const TAXONOMY = {
  Kebutuhan: ['Makan', 'Transport', 'Home', 'Kesehatan', 'Bodycare and Skincare', 'Biaya Transaksi', 'Pembayaran Utang'],
  Keinginan: ['JAJAN', 'GIFT', 'Hobby', 'Online Subscription', 'others'],
  Tabungan: ['Reksadana', 'Saham', 'ETF', 'Kripto', 'Valas', 'Emas', 'GORO', 'JAGO', 'KPR'],
  Pemasukan: ['Gaji', 'Bonus/THR', 'Pencairan Aset/Investasi', 'Pengembalian Dana', 'Transfer dari Pasangan', 'Lainnya'],
};
export const EXPENSE_GROUPS = ['Kebutuhan', 'Keinginan', 'Tabungan'];
export const SPEND_GROUPS = ['Kebutuhan', 'Keinginan'];
// Bukan pemasukan "baru": uang yang hanya berpindah tempat.
export const INTERNAL_INCOME = ['Transfer dari Pasangan', 'Pencairan Aset/Investasi'];

export const isRealIncome = t => t.kind === 'income' && !INTERNAL_INCOME.includes(t.subcategory);
export const isSpending = t => t.kind === 'expense' && SPEND_GROUPS.includes(t.category);
export const isSaving = t => t.kind === 'expense' && t.category === 'Tabungan';

const ICONS = {
  Makan: '🍜', Transport: '🚗', Home: '🏡', Kesehatan: '💊', 'Bodycare and Skincare': '🧴', 'Biaya Transaksi': '🏦', 'Pembayaran Utang': '📄',
  JAJAN: '🧋', GIFT: '🎁', Hobby: '🏃', 'Online Subscription': '📺', others: '🛍️',
  Reksadana: '📈', Saham: '📊', ETF: '🌐', Kripto: '🪙', Valas: '💱', Emas: '🥇', GORO: '🏘️', JAGO: '🐷', KPR: '🔑',
  Gaji: '💼', 'Bonus/THR': '🎉', 'Pencairan Aset/Investasi': '💰', 'Pengembalian Dana': '↩️', 'Transfer dari Pasangan': '💞', Lainnya: '✨',
};
export const iconFor = t => t.kind === 'transfer' ? '⇄' : ICONS[t.subcategory] || (t.category === 'Tabungan' ? '🐷' : t.kind === 'income' ? '💰' : '✨');
export const labelFor = t => t.kind === 'transfer' ? 'Transfer' : t.subcategory || t.category;
