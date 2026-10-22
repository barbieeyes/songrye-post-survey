// 가짜 응답 120개 + 큐리 기록 + 사전 CSV 생성 (결정적 난수)
import { writeFileSync } from "node:fs";
import { ALL_ITEMS, ESSAY_CODES } from "../assets/items.js";
let seed = 2026; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const cl = v => Math.max(1, Math.min(5, Math.round(v)));
const rows = []; let id = 1;
for (let i = 0; i < 120; i++) {
  const cls = 1 + (i % 6), num = 1 + Math.floor(i / 6), ability = rnd() * 2;
  const act_ai = cls <= 3 ? rnd() < 0.9 : rnd() < 0.2, act_curi = rnd() < 0.95;
  const answers = {};
  for (const it of ALL_ITEMS) {
    if (it.aiOnly && !act_ai) { answers[it.n] = null; continue; }
    if (it.dual) { const pre = cl(1.5 + ability + rnd() * 1.5); answers[it.n] = { pre, now: cl(pre + rnd() * 1.8) }; }
    else answers[it.n] = it.reverse ? cl(4.5 - ability - rnd() * 2) : cl(2.2 + ability + rnd() * 1.6);
  }
  const hasEssay = rnd() < 0.7;
  rows.push({ id: id++, at: `2026-10-2${3 + (i % 3)} 1${i % 6}:0${i % 10}`, grade: 3, cls, num, act_ai, act_curi, answers,
    essay: hasEssay ? { first: `처음엔 '힘이 세져서'라고 썼다 ${i}`, question: "그 힘은 어떤 에너지야?", revised: "위치에너지가 운동에너지로 전환되어 속력이 빨라진다고 고쳤다" } : { first: "", question: "", revised: "" },
    codes: hasEssay && i % 4 === 0 ? [ESSAY_CODES[i % 4]] : null, code_source: hasEssay && i % 4 === 0 ? "ai" : null });
}
// 같은 학생의 예전 제출(분석에서 빠져야 함)
rows.unshift({ ...JSON.parse(JSON.stringify(rows[0])), id: 999, at: "2026-10-22 09:00", answers: Object.fromEntries(Object.entries(rows[0].answers).map(([k, v]) => [k, v && typeof v === "object" ? { pre: 1, now: 1 } : v === null ? null : 1])) });
const curi = [];
for (const r of rows.slice(1)) if (rnd() < 0.85) {
  const stages = {}; for (const s of ["q", "h", "e", "r", "c"]) { const f = Math.floor(rnd() * 3); stages[s] = { first: String(f), last: String(Math.min(s === "c" ? 4 : 3, f + Math.floor(rnd() * 3))), n: 2 }; }
  curi.push({ grade: 3, cls: r.cls, num: r.num, attempts: 5 + Math.floor(rnd() * 20), stages });
}
curi.push({ grade: 3, cls: 9, num: 1, attempts: 7, stages: {} }); // 설문 안 한 반
const pre = ["학년,반,번호,문항8,문항9,문항16,문항18,문항19,문항21"];
for (const r of rows.slice(1)) pre.push([3, r.cls, r.num, ...[0, 0, 0, 0, 0, 0].map((_, j) => cl(2 + rnd() * 2.5))].join(","));
writeFileSync("tests/fake.json", JSON.stringify({ rows, curi, at: "2026-10-25 15:00" }));
writeFileSync("tests/pre_with_id.csv", "﻿" + pre.join("\n"));
writeFileSync("tests/pre_no_id.csv", pre.map(l => l.split(",").filter((_, j) => j !== 2).join(",")).join("\n").replace("학년,반,문항8", "학년,반,문항8"));
console.log("rows", rows.length, "curi", curi.length);
