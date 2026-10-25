// 사후 설문 분석 (브라우저·Node 공용 순수 함수)
import { DOMAINS, ALL_ITEMS, REVERSE, ESSAY_CODES, PRE_DOMAIN } from "./items.js?v=20261026a";
import { mean, sd, pairedT, welchT, cronbach, spearman } from "./stats.js?v=20261026a";

const isNum = v => typeof v === "number" && Number.isFinite(v);
export const keyOf = r => `${r.grade}-${r.cls}-${r.num}`;
const rev = (n, v) => (isNum(v) && REVERSE.includes(n) ? 6 - v : v);

// 같은 학년·반·번호는 가장 최근 응답만 (rows는 제출 순서대로 들어옴)
export function latestOnly(rows) {
  const m = new Map();
  for (const r of rows) m.set(keyOf(r), r);
  return [...m.values()].sort((a, b) => a.grade - b.grade || a.cls - b.cls || a.num - b.num);
}

// 한 학생의 문항 점수 (역채점 적용). which: 'now' | 'pre' (영역Ⅰ만)
export function score(r, n, which = "now") {
  const a = r.answers ? r.answers[n] ?? r.answers[String(n)] : null;
  if (a === null || a === undefined) return NaN;
  if (typeof a === "object") return rev(n, a[which]);
  return rev(n, a);
}
export function domainScore(r, d, which = "now") {
  const v = d.items.map(it => score(r, it.n, which)).filter(isNum);
  return v.length ? mean(v) : NaN;
}

function dist(vals) { const c = [0, 0, 0, 0, 0]; for (const v of vals) if (v >= 1 && v <= 5) c[v - 1]++; return c; }
function rawVal(r, n, which) { const a = r.answers ? r.answers[n] ?? r.answers[String(n)] : null; if (a === null || a === undefined) return NaN; return typeof a === "object" ? a[which] : a; }

export function analyze(allRows, curiList = [], preRows = null) {
  const rows = latestOnly(allRows);
  const N = rows.length;
  const out = { N, totalSubmissions: allRows.length };

  // ── 응답 현황 ──
  const curiBy = new Map(), curiKeys = new Set(curiList.map(c => `${c.grade}-${c.cls}-${c.num}`)), bothBy = new Map();
  for (const c of curiList) { const k = `${c.grade}-${c.cls}`; curiBy.set(k, (curiBy.get(k) || 0) + 1); }
  for (const r of rows) if (curiKeys.has(keyOf(r))) { const k = `${r.grade}-${r.cls}`; bothBy.set(k, (bothBy.get(k) || 0) + 1); }
  const clsBy = new Map();
  for (const r of rows) { const k = `${r.grade}-${r.cls}`; clsBy.set(k, (clsBy.get(k) || 0) + 1); }
  out.byClass = [...clsBy.entries()].sort((a, b) => { const [g1, c1] = a[0].split("-").map(Number), [g2, c2] = b[0].split("-").map(Number); return g1 - g2 || c1 - c2; })
    .map(([k, n]) => ({ cls: k, n, curi: curiBy.get(k) || 0, both: bothBy.get(k) || 0, rate: curiBy.get(k) ? (bothBy.get(k) || 0) / curiBy.get(k) : NaN }));
  out.acts = { ai: rows.filter(r => r.act_ai).length, curi: rows.filter(r => r.act_curi).length, both: rows.filter(r => r.act_ai && r.act_curi).length, none: rows.filter(r => !r.act_ai && !r.act_curi).length };

  // ── 영역별 기술통계 + 신뢰도 ──
  out.domains = DOMAINS.map(d => {
    const whichList = d.dual ? ["pre", "now"] : ["now"];
    const res = { id: d.id, name: d.name, short: d.short, dual: !!d.dual };
    for (const w of whichList) {
      const ds = rows.map(r => domainScore(r, d, w)).filter(isNum);
      const complete = rows.map(r => d.items.map(it => score(r, it.n, w))).filter(a => a.every(isNum));
      res[w] = { n: ds.length, mean: mean(ds), sd: sd(ds), alpha: d.items.length >= 3 ? cronbach(complete) : { alpha: NaN, n: complete.length, k: d.items.length } };
    }
    res.items = d.items.map(it => {
      const o = { n: it.n, t: it.t, sub: it.sub, reverse: !!it.reverse, pre: it.pre };
      for (const w of whichList) {
        const v = rows.map(r => score(r, it.n, w)).filter(isNum);
        o[w] = { n: v.length, mean: mean(v), sd: sd(v), dist: dist(rows.map(r => rawVal(r, it.n, w)).filter(isNum)) };
      }
      return o;
    });
    return res;
  });

  // ── 영역Ⅰ 수업 전 vs 지금 (대응표본) ──
  const D1 = DOMAINS.find(d => d.dual);
  out.dual = {
    items: D1.items.map(it => ({ num: it.n, text: it.t, sub: it.sub, ...pairedT(rows.map(r => score(r, it.n, "pre")), rows.map(r => score(r, it.n, "now"))) })),
    total: pairedT(rows.map(r => domainScore(r, D1, "pre")), rows.map(r => domainScore(r, D1, "now")))
  };

  // ── 영역Ⅵ 사전 설문 비교 ──
  out.pre = preRows ? comparePre(rows, preRows) : null;

  // ── 하위 집단: AI 문제 풀기 여부, 반별 ──
  const groupStats = (pred) => DOMAINS.map(d => { const v = rows.filter(pred).map(r => domainScore(r, d, "now")).filter(isNum); return { id: d.id, n: v.length, mean: mean(v), sd: sd(v) }; });
  out.byAct = {
    yes: groupStats(r => r.act_ai), no: groupStats(r => !r.act_ai),
    tests: DOMAINS.map(d => ({ id: d.id, ...welchT(rows.filter(r => !r.act_ai).map(r => domainScore(r, d, "now")), rows.filter(r => r.act_ai).map(r => domainScore(r, d, "now"))) })),
    gainI: { yes: pairedT(rows.filter(r => r.act_ai).map(r => domainScore(r, D1, "pre")), rows.filter(r => r.act_ai).map(r => domainScore(r, D1, "now"))), no: pairedT(rows.filter(r => !r.act_ai).map(r => domainScore(r, D1, "pre")), rows.filter(r => !r.act_ai).map(r => domainScore(r, D1, "now"))) }
  };
  out.byClassDomain = out.byClass.map(c => ({ cls: c.cls, n: c.n, means: DOMAINS.map(d => mean(rows.filter(r => `${r.grade}-${r.cls}` === c.cls).map(r => domainScore(r, d, "now")).filter(isNum))), gainI: mean(rows.filter(r => `${r.grade}-${r.cls}` === c.cls).map(r => domainScore(r, D1, "now") - domainScore(r, D1, "pre")).filter(isNum)) }));

  // ── 큐리 기록과 연결 ──
  const cm = new Map(curiList.map(c => [`${c.grade}-${c.cls}-${c.num}`, c]));
  const matched = rows.map(r => ({ r, c: cm.get(keyOf(r)) })).filter(x => x.c);
  const gain = x => domainScore(x.r, D1, "now") - domainScore(x.r, D1, "pre");
  const stageGain = c => { let s = 0, k = 0; for (const st of ["q", "h", "e", "r", "c"]) { const g = c.stages && c.stages[st]; if (g && g.first != null && g.last != null) { s += Number(g.last) - Number(g.first); k++; } } return k ? s : NaN; };
  const lastTotal = c => { let s = 0, k = 0; for (const st of ["q", "h", "e", "r", "c"]) { const g = c.stages && c.stages[st]; if (g && g.last != null) { s += Number(g.last); k++; } } return k ? s : NaN; };
  out.curi = {
    matched: matched.length, respondents: N,
    vars: [
      { key: "attempts", label: "큐리 총 수정 횟수", vals: matched.map(x => Number(x.c.attempts)) },
      { key: "stageGain", label: "큐리 단계별 체크 통과 1차→최종 향상(합)", vals: matched.map(x => stageGain(x.c)) },
      { key: "lastTotal", label: "큐리 최종 체크 통과 개수(합)", vals: matched.map(x => lastTotal(x.c)) }
    ].map(v => ({ key: v.key, label: v.label, ...spearman(matched.map(gain), v.vals) })),
    nowI: [
      { key: "lastTotal", label: "큐리 최종 체크 통과 개수(합)", ...spearman(matched.map(x => domainScore(x.r, D1, "now")), matched.map(x => lastTotal(x.c))) }
    ]
  };

  // ── 서술형 ──
  const withEssay = rows.filter(r => r.essay && (r.essay.first || r.essay.question || r.essay.revised));
  out.essay = {
    n: withEssay.length,
    coded: withEssay.filter(r => Array.isArray(r.codes) && r.codes.length).length,
    freq: ESSAY_CODES.map(c => ({ code: c, n: withEssay.filter(r => Array.isArray(r.codes) && r.codes.includes(c)).length,
      examples: withEssay.filter(r => Array.isArray(r.codes) && r.codes.includes(c)).sort((a, b) => essayLen(b) - essayLen(a)).slice(0, 3).map(r => ({ key: keyOf(r), ...r.essay })) }))
  };
  out.rows = rows;
  return out;
}
const essayLen = r => ((r.essay.first || "") + (r.essay.question || "") + (r.essay.revised || "")).length;

// ── 사전 설문 CSV ──
const PRE_MAP = PRE_DOMAIN.items.map(i => [i.n, i.pre]); // [사후 번호, 사전 번호]
const PRE_REV = PRE_DOMAIN.items.filter(i => i.reverse).map(i => i.pre); // 사전 16·18·19
export function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}
// 머리글에서 학년/반/번호/문항8… 열을 찾아 사전 응답 배열로 변환
export function readPreCsv(text) {
  const t = parseCsv(text);
  if (t.length < 2) return { error: "CSV에 머리글과 응답이 있어야 해요." };
  const head = t[0].map(h => String(h).replace(/\s/g, ""));
  const find = re => head.findIndex(h => re.test(h));
  const gi = find(/학년/), ci = find(/^반$|반$/), ni = find(/번호/);
  const cols = {};
  for (const [, pre] of PRE_MAP) {
    const i = head.findIndex(h => new RegExp(`^(문항|Q|q)?0?${pre}(번)?$`).test(h) || new RegExp(`문항${pre}(\\D|$)`).test(h));
    if (i < 0) return { error: `문항${pre} 열을 찾지 못했어요. 머리글을 '문항${pre}'처럼 써 주세요.` };
    cols[pre] = i;
  }
  const num = v => { const m = String(v ?? "").match(/\d+/); return m ? Number(m[0]) : NaN; };
  const data = t.slice(1).map(r => {
    const o = { grade: gi >= 0 ? num(r[gi]) : NaN, cls: ci >= 0 ? num(r[ci]) : NaN, num: ni >= 0 ? num(r[ni]) : NaN, v: {} };
    for (const [, pre] of PRE_MAP) { const x = num(r[cols[pre]]); o.v[pre] = x >= 1 && x <= 5 ? x : NaN; }
    return o;
  });
  return { data, hasId: ni >= 0 && gi >= 0 && ci >= 0 && data.filter(d => isNum(d.num)).length >= data.length * 0.5 };
}
function comparePre(rows, pre) {
  const preRev = (preNo, v) => (PRE_REV.includes(preNo) && isNum(v) ? 6 - v : v);
  const preDomain = p => { const v = PRE_MAP.map(([, pn]) => preRev(pn, p.v[pn])).filter(isNum); return v.length ? mean(v) : NaN; };
  const D6 = PRE_DOMAIN;
  const postDomain = r => domainScore(r, D6, "now");
  const pm = new Map(pre.data.filter(p => isNum(p.grade) && isNum(p.cls) && isNum(p.num)).map(p => [`${p.grade}-${p.cls}-${p.num}`, p]));
  const pairs = pre.hasId ? rows.map(r => ({ r, p: pm.get(keyOf(r)) })).filter(x => x.p) : [];
  const usePaired = pre.hasId && pairs.length >= 10;
  const items = PRE_MAP.map(([post, preNo]) => {
    const res = usePaired
      ? pairedT(pairs.map(x => preRev(preNo, x.p.v[preNo])), pairs.map(x => score(x.r, post)))
      : welchT(pre.data.map(p => preRev(preNo, p.v[preNo])), rows.map(r => score(r, post)));
    return { post, pre: preNo, reverse: PRE_REV.includes(preNo), ...res };
  });
  const total = usePaired ? pairedT(pairs.map(x => preDomain(x.p)), pairs.map(x => postDomain(x.r))) : welchT(pre.data.map(preDomain), rows.map(postDomain));
  return { method: usePaired ? "paired" : "welch", matched: pairs.length, nPre: pre.data.length, items, total };
}
