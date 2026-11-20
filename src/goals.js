// Kalkulasi savings goal. Semua nominal dalam Rupiah, return dalam % per tahun.
// Model: saldo sekarang + setoran tiap akhir bulan, berbunga majemuk bulanan (r = return/12).

export function monthsUntil(fromIso, toIso) {
  const a = new Date(`${fromIso}T12:00:00`), b = new Date(`${toIso}T12:00:00`);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return m;
}

export function addMonthsIso(fromIso, n) {
  const d = new Date(`${fromIso}T12:00:00`);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Nilai masa depan setelah n bulan.
export function futureValue(saved, monthly, annualReturn, n) {
  const r = annualReturn / 100 / 12;
  if (r === 0) return saved + monthly * n;
  const g = Math.pow(1 + r, n);
  return saved * g + monthly * (g - 1) / r;
}

// Berapa bulan sampai target tercapai. null = tidak akan tercapai dengan setoran ini.
export function monthsToReach(target, saved, monthly, annualReturn) {
  if (saved >= target) return 0;
  const r = annualReturn / 100 / 12;
  if (r === 0) return monthly > 0 ? Math.ceil((target - saved) / monthly) : null;
  if (monthly <= 0 && saved <= 0) return null;
  const n = Math.log((target * r + monthly) / (saved * r + monthly)) / Math.log(1 + r);
  return Number.isFinite(n) ? Math.max(0, Math.ceil(n - 1e-9)) : null;
}

// Setoran per bulan yang dibutuhkan supaya tercapai dalam n bulan.
export function requiredMonthly(target, saved, annualReturn, n) {
  if (saved >= target) return 0;
  if (n <= 0) return target - saved;
  const r = annualReturn / 100 / 12;
  if (r === 0) return (target - saved) / n;
  const g = Math.pow(1 + r, n);
  return Math.max(0, (target - saved * g) * r / (g - 1));
}

export function goalPlan(goal, todayIso) {
  const target = Number(goal.target_amount), saved = Number(goal.saved_amount || 0);
  const monthly = Number(goal.monthly_contribution || 0), ret = Number(goal.annual_return || 0);
  const progress = Math.min(1, saved / target);
  const remaining = Math.max(0, target - saved);
  const months = monthsToReach(target, saved, monthly, ret);
  const eta = months == null ? null : addMonthsIso(todayIso, months);
  let monthsLeft = null, needed = null, status = saved >= target ? 'done' : months == null ? 'no-plan' : 'open';
  if (goal.target_date && saved < target) {
    monthsLeft = Math.max(0, monthsUntil(todayIso, goal.target_date));
    needed = requiredMonthly(target, saved, ret, Math.max(1, monthsLeft));
    if (months != null) status = months <= monthsLeft ? 'on-track' : 'behind';
    else status = 'behind';
  }
  const gap = needed != null ? Math.max(0, needed - monthly) : 0;
  return { target, saved, monthly, ret, progress, remaining, months, eta, monthsLeft, needed, gap, status };
}
