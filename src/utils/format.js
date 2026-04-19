// Czech-locale formatters used across UI.

const nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });

export function fmtKc(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} mld. Kč`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)} mil. Kč`;
  if (abs >= 1e3) return `${nf.format(n)} Kč`;
  return `${nf.format(n)} Kč`;
}

export function fmtNum(n) { return nf.format(n); }

export function fmtPct(n) { return `${(n * 100).toFixed(1)} %`; }

const MONTHS = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
export function fmtDate(date) {
  return `${date.d}. ${MONTHS[date.m]} ${date.y}`;
}
