// 무작위 자료로 통계 함수 결과를 JSON으로 출력 → check_stats.py 가 scipy와 비교
import * as S from "../assets/stats.js";
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const lik = (bias=0) => Math.max(1, Math.min(5, Math.round(1 + rnd()*4 + bias)));
const cases = [];
for (let c = 0; c < 40; c++) {
  const n = 5 + Math.floor(rnd() * 120);
  const x = Array.from({length:n}, () => lik(-0.5)), y = x.map(v => Math.max(1, Math.min(5, v + Math.round(rnd()*2 - 0.4))));
  const z = Array.from({length: 4 + Math.floor(rnd()*80)}, () => lik(0.3));
  const k = 3 + Math.floor(rnd()*6);
  const rows = Array.from({length:n}, () => { const base = rnd()*3; return Array.from({length:k}, () => Math.max(1, Math.min(5, Math.round(1 + base + rnd()*2)))); });
  const a = Array.from({length:n}, () => Math.round(rnd()*30)), b = a.map(v => v*0.3 + rnd()*10);
  cases.push({ x, y, z, rows, a, b, paired: S.pairedT(x, y), welch: S.welchT(x, z), alpha: S.cronbach(rows), sp: S.spearman(a, b) });
}
process.stdout.write(JSON.stringify(cases));
