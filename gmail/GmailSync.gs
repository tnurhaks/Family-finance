/**
 * Family Finance — Sinkron Gmail → Supabase
 * Dipasang di akun Google MASING-MASING (kamu dan suami), dengan token masing-masing.
 *
 * Script Properties (Project Settings → Script Properties) yang wajib diisi:
 *   SUPABASE_URL      = https://xxxx.supabase.co
 *   SUPABASE_KEY      = sb_publishable_...   (publishable key, BUKAN secret key)
 *   INGEST_TOKEN      = ffg_...              (dari aplikasi: menu Keluarga → Buat token)
 *
 * Cara pakai:
 *   1. Jalankan testParse() dulu → cek log (View → Logs). Belum ada yang dikirim.
 *   2. Kalau hasil parsing sudah benar, jalankan installTrigger() sekali.
 *      Setelah itu syncGmail() otomatis jalan tiap 15 menit.
 */

// ===== 1. PENGATURAN — sesuaikan dengan nama rekening di aplikasi =====
// Nama rekening HARUS sama persis (huruf besar/kecil bebas) dengan nama rekening di aplikasi.
const ACCOUNT_DEFAULT = {
  jago: 'JAGO BAYAR',
  mandiri: 'MANDIRI',
  mandiriCredit: 'SKYZ',      // kartu kredit Mandiri
  bca: 'BCA',
  bibit: 'JAGO BAYAR',        // dibayar dari rekening mana? ubah bila perlu
  goro: 'MANDIRI',
  stockbit: 'RDN BCA',
  gotrade: 'JAGO BAYAR',
};

// Pengirim email yang dibaca. Tambahkan alamat Pintu bila sudah tahu.
const SENDERS = [
  'noreply@jago.com', 'noreply.livin@bankmandiri.co.id', 'bca@bca.co.id',
  'no-reply@bibit.id', 'hello@goro.id', 'no-reply@stockbit.com', 'no-reply@heygotrade.com',
];

// Kata kunci merchant → Sub Kategori (Budggt). Kalau cocok = Auto Mode.
const MERCHANT_RULES = [
  [/roti|bakery|bakmi|ayam|soto|nasi|warung|resto|kopi|coffee|cafe|kafe|bebek|sate|mie|padang|starbucks|mcd|kfc|hokben|tuku|janji jiwa|kenangan|fore/i, 'Kebutuhan', 'Makan'],
  [/alfamart|indomaret|aeon|superindo|hypermart|lotte|transmart|ranch market|grand lucky/i, 'Kebutuhan', 'Home'],
  [/gojek|gopay|grab|ovo|flazz|e-?money|tapcash|brizzi|shell|pertamina|spbu|bp |parkir|tol|krl|mrt|transjakarta|kai/i, 'Kebutuhan', 'Transport'],
  [/apotek|kimia farma|guardian|century|klinik|rumah sakit|rs |dokter|prodia/i, 'Kebutuhan', 'Kesehatan'],
  [/netflix|spotify|youtube|icloud|apple\.com|google one|disney|vidio/i, 'Keinginan', 'Online Subscription'],
];

const LABEL_DONE = 'ff-synced';
const SEARCH_WINDOW = 'newer_than:3d';

// ===== 2. FUNGSI UTAMA =====
function syncGmail() {
  const cfg = getConfig_();
  const label = GmailApp.getUserLabelByName(LABEL_DONE) || GmailApp.createLabel(LABEL_DONE);
  const threads = GmailApp.search(buildQuery_() + ' -label:' + LABEL_DONE, 0, 50);
  const items = [];
  threads.forEach(t => t.getMessages().forEach(m => { const it = parseMessage_(m); if (it) items.push(it); }));
  if (items.length) {
    const res = postToSupabase_(cfg, items);
    console.log('Terkirim:', JSON.stringify(res));
  }
  // Tandai hanya setelah berhasil terkirim (kalau gagal, error di atas menghentikan script).
  threads.forEach(t => t.addLabel(label));
}

function testParse() {
  const threads = GmailApp.search(buildQuery_(), 0, 15);
  threads.forEach(t => t.getMessages().forEach(m => {
    const it = parseMessage_(m);
    console.log(it ? JSON.stringify(it, null, 1) : 'Dilewati: ' + m.getSubject());
  }));
}

function installTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncGmail').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncGmail').timeBased().everyMinutes(15).create();
  console.log('Trigger terpasang: syncGmail tiap 15 menit.');
}

// ===== 3. PARSER PER PENGIRIM =====
function parseMessage_(m) {
  const from = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].toLowerCase().trim();
  const subject = m.getSubject() || '';
  const text = m.getPlainBody() || stripHtml_(m.getBody());
  const base = {
    external_id: m.getId(), sender: from, subject: subject,
    snippet: text.replace(/\s+/g, ' ').slice(0, 500),
    occurred_on: Utilities.formatDate(m.getDate(), 'Asia/Jakarta', 'yyyy-MM-dd'),
    kind: 'expense', confidence: 'low', category: '', subcategory: '', account_hint: '', merchant: '', note: '', reason: '',
  };
  let it;
  if (from.indexOf('jago.com') > -1) it = parseJago_(base, text);
  else if (from.indexOf('bankmandiri') > -1) it = parseMandiri_(base, text);
  else if (from.indexOf('bca.co.id') > -1) it = parseBca_(base, text);
  else if (from.indexOf('bibit.id') > -1) it = parseInvest_(base, text, 'Reksadana', ACCOUNT_DEFAULT.bibit, /pembelian|beli|purchase/i);
  else if (from.indexOf('goro.id') > -1) it = parseInvest_(base, text, 'GORO', ACCOUNT_DEFAULT.goro, /order|pembelian|beli/i);
  else if (from.indexOf('stockbit') > -1) it = parseInvest_(base, text, 'Saham', ACCOUNT_DEFAULT.stockbit, null);
  else if (from.indexOf('heygotrade') > -1) it = parseInvest_(base, text, 'ETF', ACCOUNT_DEFAULT.gotrade, null);
  if (!it) return null;
  // Aturan aman: refund/pengembalian & transaksi masuk selalu direview manual.
  if (/refund|pengembalian|dikembalikan|reversal/i.test(subject + ' ' + text)) {
    it.confidence = 'low'; it.kind = 'income'; it.category = 'Pemasukan'; it.subcategory = 'Pengembalian Dana'; it.reason = 'Refund — wajib review';
  }
  if (!it.amount) { it.confidence = 'low'; it.reason = it.reason || 'Nominal tidak terbaca'; }
  return it;
}

// Jago: notifikasi kartu debit tidak menampilkan merchant → aturan nominal (keputusanmu):
// < Rp20.000 = Transport, ≥ Rp20.000 = Makan, langsung Auto Mode.
function parseJago_(it, text) {
  it.account_hint = ACCOUNT_DEFAULT.jago;
  it.amount = findAmount_(text, ['Nominal', 'Jumlah', 'Amount', 'Total']);
  if (/masuk|diterima|received|incoming|top ?up berhasil ke/i.test(it.subject + ' ' + text) && !/kartu debit|debit card/i.test(text)) {
    it.kind = 'income'; it.category = 'Pemasukan'; it.subcategory = 'Lainnya'; it.reason = 'Uang masuk — cek sumbernya'; return it;
  }
  if (/pocket|kantong bersama|shared/i.test(text) && /kmrp|uang kas/i.test(text)) return null; // Shared Pocket orang lain: dilewati
  it.merchant = findField_(text, ['Merchant', 'Tujuan', 'Penerima', 'Ke']) || '';
  const rule = it.merchant && matchMerchant_(it.merchant);
  if (rule) { it.category = rule[0]; it.subcategory = rule[1]; it.confidence = 'high'; it.reason = 'Merchant dikenali'; }
  else if (it.amount) {
    it.category = 'Kebutuhan'; it.subcategory = it.amount < 20000 ? 'Transport' : 'Makan';
    it.confidence = 'high'; it.reason = 'Aturan nominal Jago';
  }
  return it;
}

function parseMandiri_(it, text) {
  it.amount = findAmount_(text, ['Nominal Transaksi', 'Total Transaksi', 'Nominal', 'Jumlah', 'Total']);
  it.merchant = findField_(text, ['Nama Merchant', 'Merchant', 'Penerima', 'Nama Penerima', 'Tujuan']) || '';
  const source = findField_(text, ['Sumber Dana', 'Dari', 'Rekening Sumber']) || '';
  it.account_hint = /kartu kredit|credit/i.test(source + ' ' + text) ? ACCOUNT_DEFAULT.mandiriCredit : ACCOUNT_DEFAULT.mandiri;
  if (/transfer/i.test(it.subject) && !/qris/i.test(it.subject + text)) { it.reason = 'Transfer keluar — tentukan kategori/transfer'; return it; }
  const rule = it.merchant && matchMerchant_(it.merchant);
  if (rule) { it.category = rule[0]; it.subcategory = rule[1]; it.confidence = 'high'; it.reason = 'Merchant dikenali'; }
  else { it.category = 'Kebutuhan'; it.reason = 'Merchant belum dikenal'; }
  return it;
}

// BCA "Internet Transaction Journal": baris "Label : nilai", nominal format "IDR 210,000.00".
function parseBca_(it, text) {
  it.account_hint = ACCOUNT_DEFAULT.bca;
  it.amount = findAmount_(text, ['Transfer Amount', 'Total Payment', 'Payment Amount', 'Amount', 'Nominal', 'Jumlah']);
  it.merchant = findField_(text, ['Beneficiary Name', 'Company/Biller Name', 'Merchant', 'Nama Penerima']) || '';
  const remarks = findField_(text, ['Remarks', 'Berita', 'Keterangan']) || '';
  it.note = [it.merchant, remarks].filter(String).join(' — ');
  const rule = matchMerchant_(it.merchant + ' ' + remarks);
  if (rule) { it.category = rule[0]; it.subcategory = rule[1]; it.confidence = 'high'; it.reason = 'Dikenali dari penerima/berita'; }
  else it.reason = 'Transfer keluar — tentukan kategori atau tandai Transfer';
  return it;
}

function parseInvest_(it, text, sub, account, buyPattern) {
  it.amount = findAmount_(text, ['Total Pembayaran', 'Total Pembelian', 'Nominal Pembelian', 'Total', 'Nominal', 'Jumlah', 'Amount']);
  it.account_hint = account; it.category = 'Tabungan'; it.subcategory = sub;
  if (/penjualan|jual|redeem|pencairan|sell/i.test(it.subject + ' ' + text)) {
    it.kind = 'income'; it.category = 'Pemasukan'; it.subcategory = 'Pencairan Aset/Investasi'; it.reason = 'Penjualan investasi'; it.confidence = 'low';
    return it;
  }
  it.confidence = buyPattern && buyPattern.test(it.subject + ' ' + text) ? 'high' : 'low';
  it.reason = it.confidence === 'high' ? 'Pembelian investasi' : 'Cek apakah ini pembelian';
  return it;
}

// ===== 4. HELPER =====
function matchMerchant_(name) { for (const r of MERCHANT_RULES) if (r[0].test(name)) return [r[1], r[2]]; return null; }

function findField_(text, labels) {
  for (const l of labels) {
    const re = new RegExp(escapeRe_(l) + '\\s*[:：]?\\s*\\n?\\s*([^\\n]{2,80})', 'i');
    const m = text.match(re);
    if (m) return m[1].replace(/^[:：\s]+/, '').trim();
  }
  return '';
}

function findAmount_(text, labels) {
  for (const l of labels) {
    const re = new RegExp(escapeRe_(l) + '[^\\n\\d]{0,25}(?:IDR|Rp\\.?)?\\s*([\\d.,]+\\d)', 'i');
    const m = text.match(re); const v = m && parseAmount_(m[1]);
    if (v) return v;
  }
  const any = text.match(/(?:IDR|Rp\.?)\s*([\d.,]+\d)/i);
  return any ? parseAmount_(any[1]) : null;
}

// Mengatasi dua format: "210,000.00" (BCA, Inggris) dan "210.000,00" (Indonesia).
function parseAmount_(s) {
  s = String(s).trim();
  let n;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) n = Number(s.replace(/,/g, ''));
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) n = Number(s.replace(',', '.'));
  else n = NaN;
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function buildQuery_() { return '(' + SENDERS.map(s => 'from:' + s).join(' OR ') + ') ' + SEARCH_WINDOW; }
function stripHtml_(h) { return String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); }
function escapeRe_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = { url: p.getProperty('SUPABASE_URL'), key: p.getProperty('SUPABASE_KEY'), token: p.getProperty('INGEST_TOKEN') };
  if (!cfg.url || !cfg.key || !cfg.token) throw new Error('Isi SUPABASE_URL, SUPABASE_KEY, INGEST_TOKEN di Script Properties.');
  return cfg;
}

function postToSupabase_(cfg, items) {
  const res = UrlFetchApp.fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/ingest_gmail', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: cfg.key },
    payload: JSON.stringify({ p_token: cfg.token, p_items: items }),
  });
  if (res.getResponseCode() >= 300) throw new Error('Supabase menolak (' + res.getResponseCode() + '): ' + res.getContentText());
  return JSON.parse(res.getContentText());
}
