// 통계 함수 (브라우저·Node 공용). 결과는 tests/check_stats.py 에서 scipy와 대조함.

export const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
export function sd(a) { // 표본표준편차 (n-1)
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
export const variance = a => { const s = sd(a); return s * s; };

// ── 감마·베타 함수 (Lanczos, 연분수) ──
function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
export function ibeta(x, a, b) { // 정규화 불완전 베타 I_x(a,b)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
// t분포 양측 p값
export function tTwoSidedP(t, df) {
  if (!isFinite(t)) return t === t ? 0 : NaN;
  if (!(df > 0)) return NaN;
  return ibeta(df / (df + t * t), df / 2, 0.5);
}

// 대응표본 t검정 (x: 사전, y: 사후). 차이 = y - x
export function pairedT(x, y) {
  const d = [], xs = [], ys = [];
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { d.push(y[i] - x[i]); xs.push(x[i]); ys.push(y[i]); }
  const n = d.length, md = mean(d), sdd = sd(d);
  const t = sdd === 0 ? (md === 0 ? NaN : Infinity * Math.sign(md)) : md / (sdd / Math.sqrt(n));
  const df = n - 1;
  return { n, m1: mean(xs), sd1: sd(xs), m2: mean(ys), sd2: sd(ys), diff: md, sdDiff: sdd, t, df, p: tTwoSidedP(t, df), dz: sdd ? md / sdd : NaN };
}

// Welch t검정 (x: 사전 집단, y: 사후 집단). 차이 = 평균(y) - 평균(x)
export function welchT(x, y) {
  x = x.filter(Number.isFinite); y = y.filter(Number.isFinite);
  const n1 = x.length, n2 = y.length, v1 = variance(x), v2 = variance(y);
  const se2 = v1 / n1 + v2 / n2;
  const t = (mean(y) - mean(x)) / Math.sqrt(se2);
  const df = se2 * se2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  return { n1, n2, m1: mean(x), sd1: Math.sqrt(v1), m2: mean(y), sd2: Math.sqrt(v2), diff: mean(y) - mean(x), t, df, p: tTwoSidedP(t, df), d: (mean(y) - mean(x)) / sp };
}

// Cronbach's α (rows: 응답자별 문항 점수 배열, 결측 행 제외)
export function cronbach(rows) {
  const R = rows.filter(r => r.every(Number.isFinite));
  const k = R.length ? R[0].length : 0;
  if (k < 2 || R.length < 3) return { alpha: NaN, n: R.length, k };
  const itemVar = Array.from({ length: k }, (_, j) => variance(R.map(r => r[j])));
  const totVar = variance(R.map(r => r.reduce((s, v) => s + v, 0)));
  return { alpha: (k / (k - 1)) * (1 - itemVar.reduce((s, v) => s + v, 0) / totVar), n: R.length, k };
}

// 평균 순위 (동점은 평균 순위)
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
export function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
// 스피어만 상관 (p값: scipy와 같은 t 근사, df = n-2)
export function spearman(x, y) {
  const xs = [], ys = [];
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { xs.push(x[i]); ys.push(y[i]); }
  const n = xs.length;
  if (n < 3) return { rho: NaN, p: NaN, n };
  const rho = pearson(ranks(xs), ranks(ys));
  const df = n - 2;
  const t = rho * Math.sqrt(df / ((1 - rho) * (1 + rho)));
  return { rho, p: Math.abs(rho) >= 1 ? 0 : tTwoSidedP(t, df), n };
}

export const fmt = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : "–";
export const fmtP = p => !Number.isFinite(p) ? "–" : p < .001 ? "<.001" : p.toFixed(3).replace(/^0/, "");
export const stars = p => !Number.isFinite(p) ? "" : p < .001 ? "***" : p < .01 ? "**" : p < .05 ? "*" : "";
