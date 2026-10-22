import { SUPABASE_URL, SUPABASE_KEY, DOMAINS, ESSAY_CODES, SCALE } from "./items.js";
import { analyze, readPreCsv, keyOf, domainScore } from "./analysis.js";
import { fmt, fmtP, stars } from "./stats.js";
import { makeXlsx } from "./xlsx.js";
import { autoCode } from "./autocode.js";

const PW_KEY = "post-survey-pw";
const $app = document.getElementById("app");
const DIST_COLORS = ["#D9553F", "#EFA35C", "#C5C8D6", "#7AAEDE", "#2F63B8"];
let PW = null, DATA = null, PRE = null, PRE_NAME = "", RES = null;
const dirtyCodes = new Map();

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "style") e.setAttribute("style", v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(5)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const svgEl = (tag, attrs = {}, ...kids) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; };
function toast(msg) { const t = el("div", { class: "toast", role: "status", text: msg }); document.body.append(t); setTimeout(() => t.remove(), 2200); }
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 로그인 ──
function renderLogin(err = "") {
  const inp = el("input", { type: "password", inputmode: "numeric", autocomplete: "current-password", "aria-label": "비밀번호", id: "pw" });
  const btn = el("button", { class: "btn primary", type: "submit", style: "width:100%;margin-top:12px", text: "들어가기" });
  $app.replaceChildren(el("form", { class: "card login", onsubmit: async e => { e.preventDefault(); if (!inp.value.trim()) return; btn.disabled = true; btn.textContent = "확인하는 중…"; await load(inp.value.trim()); } },
    el("div", { style: "font-size:40px", "aria-hidden": "true", text: "🔒" }),
    el("h1", { style: "font-size:20px;margin:6px 0", text: "사후 설문 분석" }),
    el("p", { class: "small", text: "큐리 교사용 현황판과 같은 비밀번호를 넣어 주세요." }),
    inp, err ? el("div", { class: "alert err", role: "alert", text: err }) : null, btn));
  inp.focus();
}
async function load(pw) {
  try {
    const d = await rpc("post_survey_rows", { pw });
    if (d && d.error) { ss.del(PW_KEY); return renderLogin(d.error === "locked" ? "비밀번호를 여러 번 틀려서 잠시 잠겼어요. 10분 뒤에 다시 해 주세요." : "비밀번호가 맞지 않아요."); }
    PW = pw; ss.set(PW_KEY, pw); DATA = d; dirtyCodes.clear(); renderAll();
  } catch (e) { console.error("load-fail", e); renderLogin("불러오지 못했어요. 인터넷 연결을 확인해 주세요."); }
}

// ── 표 블록 (복사 버튼 포함) ──
const tsvCell = v => String(v ?? "").replace(/[\t\n\r]+/g, " ");
function tableBlock(headers, rows, opts = {}) {
  const tsv = [headers, ...rows.map(r => r.map(c => (c && c.text !== undefined ? c.text : c)))].map(r => r.map(tsvCell).join("\t")).join("\n");
  const copyBtn = el("button", { class: "tbtn", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(tsv); toast("표를 복사했어요. 한글이나 엑셀에 붙여 넣으세요."); } catch (e) { toast("복사하지 못했어요."); } }, text: "표 복사" });
  const table = el("table", { class: "t" },
    el("thead", {}, el("tr", {}, headers.map((h, i) => el("th", { class: (opts.left || [0]).includes(i) ? "l" : null, scope: "col", text: h })))),
    el("tbody", {}, rows.map((r, ri) => el("tr", { class: opts.sumRow === ri ? "sum" : null }, r.map((c, i) => {
      const cls = (opts.left || [0]).includes(i) ? "l" : null;
      if (c && c.node) return el("td", { class: cls }, c.node);
      return el("td", { class: cls, text: c && c.text !== undefined ? c.text : c });
    })))));
  return el("div", {}, el("div", { class: "tools" }, copyBtn, opts.extra), el("div", { class: "tbox" }, table));
}
const distBar = d => { const n = d.reduce((a, b) => a + b, 0) || 1; return el("div", { class: "distbar", title: d.map((c, i) => `${i + 1}: ${c}명`).join(" · ") }, d.map((c, i) => c ? el("div", { style: `width:${c / n * 100}%;background:${DIST_COLORS[i]}` }) : null)); };
const pTxt = p => (p < .001 ? "p<.001" : `p=${fmtP(p)}`);

// ── 그래프: 영역Ⅰ 하위요소 변화량 ──
function gainChart(items) {
  const W = 720, rowH = 30, top = 10, left = 130, right = 70, H = top + items.length * rowH + 30;
  const max = Math.max(1, ...items.map(i => Math.abs(i.diff) || 0));
  const scale = v => (v / max) * (W - left - right);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "영역Ⅰ 하위요소별 평균 변화량 막대그래프" });
  items.forEach((it, i) => {
    const y = top + i * rowH;
    svg.append(svgEl("text", { x: left - 10, y: y + 18, "text-anchor": "end", "font-size": 13, fill: "#22243A" }, `${it.num}. ${it.sub}`));
    const w = Math.max(0, scale(it.diff || 0));
    svg.append(svgEl("rect", { x: left, y: y + 5, width: w, height: 18, rx: 3, fill: it.p < .05 ? "#5847B8" : "#B7AEE8" }));
    svg.append(svgEl("text", { x: left + w + 6, y: y + 18, "font-size": 12.5, fill: "#22243A" }, `${fmt(it.diff)}${stars(it.p)}`));
  });
  svg.append(svgEl("line", { x1: left, x2: left, y1: top, y2: top + items.length * rowH, stroke: "#8A8DA6" }));
  svg.append(svgEl("text", { x: left, y: H - 6, "font-size": 12, fill: "#5B5E78" }, "막대 = 수업 후 − 수업 전 (점수 차이) · 진한 색 = p<.05"));
  return svg;
}

// ── 화면 전체 ──
function renderAll() {
  const rows = (DATA.rows || []).map(r => ({ ...r, codes: dirtyCodes.has(r.id) ? dirtyCodes.get(r.id) : r.codes }));
  RES = analyze(rows, DATA.curi || [], PRE);
  const R = RES;
  const nav = [["status", "응답 현황"], ["domains", "영역별 결과"], ["prepost", "수업 전·후"], ["pre", "사전 설문 비교"], ["groups", "집단 비교"], ["curi", "큐리 기록 연결"], ["essay", "서술형"], ["report", "보고서 문장·내보내기"]];
  const sections = [secStatus(R), secDomains(R), secPrePost(R), secPre(R), secGroups(R), secCuri(R), secEssay(R), secReport(R)];
  $app.replaceChildren(
    el("div", { class: "thead" },
      el("div", {}, el("h1", { text: "📊 사후 설문 분석" }), el("div", { class: "small", text: `${DATA.at} 기준 · 같은 학년·반·번호는 가장 최근 응답만 분석` })),
      el("div", { class: "tools" },
        el("button", { class: "tbtn solid", type: "button", disabled: !R.N, onclick: () => exportXlsx(R), text: "📥 학생 결과 엑셀로 내려받기" }),
        el("button", { class: "tbtn", type: "button", onclick: () => load(PW), text: "↻ 새로고침" }),
        el("button", { class: "tbtn", type: "button", onclick: () => { ss.del(PW_KEY); PW = null; DATA = null; PRE = null; renderLogin(); }, text: "나가기" }))),
    el("nav", { class: "tnav", "aria-label": "분석 메뉴" }, nav.map(([id, t]) => el("a", { href: `#${id}`, text: t }))),
    ...(R.N === 0 ? [el("div", { class: "alert ok", text: "아직 응답이 없어요. 학생들이 제출하면 여기에 바로 나타나요." })] : []),
    ...sections);
}

function secStatus(R) {
  return el("section", { class: "sec", id: "status" },
    el("h2", { text: "응답 현황" }),
    el("div", { class: "kpis" }, [["응답 학생", R.N, "명"], ["전체 제출", R.totalSubmissions, "건"], ["AI 문제 풀기 참여", R.acts.ai, "명"], ["큐리 탐구 참여", R.acts.curi, "명"], ["큐리 기록과 연결", R.curi.matched, "명"]]
      .map(([l, v, u]) => el("div", { class: "kpi" }, el("div", { class: "l", text: l }), el("div", { class: "v" }, `${v}`, el("span", { style: "font-size:14px;color:var(--ink-soft);font-weight:500", text: ` ${u}` }))))),
    tableBlock(["반", "설문 응답 수", "큐리 개인 제출 수", "그중 설문 응답", "응답률"], R.byClass.map(c => [c.cls.replace("-", "학년 ") + "반", c.n, c.curi || "–", c.curi ? c.both : "–", Number.isFinite(c.rate) ? `${Math.round(c.rate * 100)}%` : "–"])),
    el("p", { class: "note", text: "응답률 = 큐리에 개인 제출한 학생 중 설문에도 응답한 학생 비율(학년·반·번호로 확인). 큐리를 하지 않은 반은 '–'로 표시돼요." }));
}

function secDomains(R) {
  const sum = [];
  for (const d of R.domains) {
    for (const w of d.dual ? ["pre", "now"] : ["now"]) {
      const s = d[w];
      sum.push([`${d.short}${d.dual ? (w === "pre" ? " (수업 전)" : " (수업 후)") : ""}`, s.n, fmt(s.mean), fmt(s.sd), Number.isFinite(s.alpha.alpha) ? fmt(s.alpha.alpha, 3) : "–"]);
    }
  }
  const legend = el("div", { class: "legend" }, SCALE.map((s, i) => el("span", {}, el("i", { style: `background:${DIST_COLORS[i]}` }), `${i + 1} ${s}`)));
  return el("section", { class: "sec", id: "domains" },
    el("h2", { text: "영역별 결과" }),
    el("p", { class: "lead", text: "역문항(12, 27, 28, 29번)은 6에서 뺀 점수로 계산해서, 모든 영역에서 점수가 높을수록 긍정적이에요. 분포 막대는 학생이 실제로 고른 원점수예요." }),
    tableBlock(["영역", "n", "평균", "표준편차", "Cronbach α"], sum),
    el("p", { class: "note", text: "α는 문항이 3개 이상인 영역만, 모든 문항에 답한 학생으로 계산해요. 영역Ⅴ에는 AI 문제 풀기를 한 학생만 답하는 21번이 있어서 α의 n이 다를 수 있어요." }),
    legend,
    R.domains.map(d => el("div", { style: "margin-top:14px" },
      el("h3", { style: "font-size:15.5px;margin:10px 0 2px", text: d.name }),
      tableBlock(d.dual ? ["번호", "문항", "수업 전 평균", "수업 전 SD", "수업 후 평균", "수업 후 SD", "수업 후 분포"] : ["번호", "문항", "n", "평균", "표준편차", "분포(원점수)"],
        d.items.map(it => d.dual
          ? [it.n, it.t, fmt(it.pre.mean), fmt(it.pre.sd), fmt(it.now.mean), fmt(it.now.sd), { node: distBar(it.now.dist), text: it.now.dist.join("/") }]
          : [it.n, { node: el("span", {}, it.t, it.reverse ? el("span", { class: "tag", text: "역채점" }) : null), text: it.t + (it.reverse ? " (역채점)" : "") }, it.now.n, fmt(it.now.mean), fmt(it.now.sd), { node: distBar(it.now.dist), text: it.now.dist.join("/") }]),
        { left: [1] }))));
}

function secPrePost(R) {
  const t = R.dual.total;
  const rows = [...R.dual.items.map(i => [`${i.num}`, i.sub, i.n, `${fmt(i.m1)} (${fmt(i.sd1)})`, `${fmt(i.m2)} (${fmt(i.sd2)})`, fmt(i.diff), fmt(i.t), i.df, fmtP(i.p) + stars(i.p), fmt(i.dz)]),
    ["전체", "영역 평균", t.n, `${fmt(t.m1)} (${fmt(t.sd1)})`, `${fmt(t.m2)} (${fmt(t.sd2)})`, fmt(t.diff), fmt(t.t), t.df, fmtP(t.p) + stars(t.p), fmt(t.dz)]];
  return el("section", { class: "sec", id: "prepost" },
    el("h2", { text: "영역Ⅰ 과학적 의사소통: 수업 전 vs 수업 후" }),
    el("p", { class: "lead", text: "같은 학생이 '수업 전의 나'와 '수업 후의 나'에 답한 값을 대응표본 t검정으로 비교했어요. dz = 평균 차이 ÷ 차이의 표준편차." }),
    tableBlock(["문항", "하위요소", "n", "수업 전 M(SD)", "수업 후 M(SD)", "차이", "t", "df", "p", "dz"], rows, { left: [1], sumRow: R.dual.items.length }),
    gainChart(R.dual.items),
    el("p", { class: "note", text: "* p<.05, ** p<.01, *** p<.001. 회고식(수업이 끝난 뒤 수업 전을 떠올려 답함) 응답이라는 점을 보고서 한계에 함께 적어 주세요." }));
}

function secPre(R) {
  const file = el("input", { type: "file", accept: ".csv,text/csv", "aria-label": "사전 설문 CSV 파일", onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    let txt = await f.text();
    if (txt.includes("�")) { try { txt = new TextDecoder("euc-kr").decode(await f.arrayBuffer()); } catch (er) {} }
    const p = readPreCsv(txt);
    if (p.error) { toast(p.error); return; }
    PRE = p; PRE_NAME = f.name; renderAll(); location.hash = "#pre";
  } });
  const body = [];
  if (R.pre) {
    const P = R.pre, paired = P.method === "paired";
    body.push(el("div", { class: "alert ok", text: paired ? `대응표본 t검정을 썼어요. 사전·사후 모두 있는 학생 ${P.matched}명을 학년·반·번호로 짝지었어요. (사전 파일: ${PRE_NAME}, ${P.nPre}명)` : `학번으로 짝지을 수 없어서(또는 짝지은 학생이 10명 미만) 두 집단을 Welch t검정으로 비교했어요. (사전 ${P.nPre}명 · 사후 ${R.N}명, 사전 파일: ${PRE_NAME})` }));
    body.push(tableBlock(["사후 번호", "사전 번호", "문항", paired ? "n" : "n(사전/사후)", "사전 M(SD)", "사후 M(SD)", "차이", "t", "df", "p", paired ? "dz" : "d"],
      [...P.items.map(i => [i.post, i.pre, DOMAINS.find(d => d.id === "VI").items.find(x => x.n === i.post).t + (i.reverse ? " (역채점)" : ""), paired ? i.n : `${i.n1}/${i.n2}`, `${fmt(i.m1)} (${fmt(i.sd1)})`, `${fmt(i.m2)} (${fmt(i.sd2)})`, fmt(i.diff), fmt(i.t), fmt(i.df, paired ? 0 : 1), fmtP(i.p) + stars(i.p), fmt(paired ? i.dz : i.d)]),
       ["전체", "", "영역Ⅵ 평균", paired ? P.total.n : `${P.total.n1}/${P.total.n2}`, `${fmt(P.total.m1)} (${fmt(P.total.sd1)})`, `${fmt(P.total.m2)} (${fmt(P.total.sd2)})`, fmt(P.total.diff), fmt(P.total.t), fmt(P.total.df, paired ? 0 : 1), fmtP(P.total.p) + stars(P.total.p), fmt(paired ? P.total.dz : P.total.d)]],
      { left: [2], sumRow: P.items.length }));
    body.push(el("p", { class: "note", text: "사전 16·18·19번(사후 27·28·29번)은 역채점해서 비교해요. 점수가 높을수록 긍정적이에요." }));
  }
  return el("section", { class: "sec", id: "pre" },
    el("h2", { text: "영역Ⅵ: 사전 설문과 비교" }),
    el("p", { class: "lead", text: "사전 설문 결과 CSV를 올려 주세요. 머리글: 학년, 반, 번호(없어도 됨), 문항8, 문항9, 문항16, 문항18, 문항19, 문항21. 파일은 이 브라우저에서만 읽고 어디에도 저장하지 않아요." }),
    el("div", { class: "tools" }, file, R.pre ? el("button", { class: "tbtn", type: "button", onclick: () => { PRE = null; PRE_NAME = ""; renderAll(); }, text: "사전 파일 빼기" }) : null),
    body);
}

function secGroups(R) {
  const ids = DOMAINS.map(d => d.id);
  return el("section", { class: "sec", id: "groups" },
    el("h2", { text: "집단 비교" }),
    el("h3", { style: "font-size:15.5px;margin:6px 0", text: "AI와 문답하며 문제를 풀었는지에 따라" }),
    tableBlock(["영역", "푼 학생 n", "푼 학생 M(SD)", "안 푼 학생 n", "안 푼 학생 M(SD)", "차이", "t(Welch)", "p"],
      ids.map((id, i) => { const y = R.byAct.yes[i], n = R.byAct.no[i], t = R.byAct.tests[i]; return [DOMAINS[i].short + (DOMAINS[i].dual ? " (지금)" : ""), y.n, `${fmt(y.mean)} (${fmt(y.sd)})`, n.n, n.n ? `${fmt(n.mean)} (${fmt(n.sd)})` : "–", fmt(t.diff), fmt(t.t), fmtP(t.p) + stars(t.p)]; })),
    el("p", { class: "note", text: `영역Ⅰ 향상(수업 후−수업 전): 푼 학생 ${fmt(R.byAct.gainI.yes.diff)}점(n=${R.byAct.gainI.yes.n}), 안 푼 학생 ${fmt(R.byAct.gainI.no.diff)}점(n=${R.byAct.gainI.no.n}). 영역Ⅲ은 푼 학생만 답해서 비교하지 않아요.` }),
    el("h3", { style: "font-size:15.5px;margin:14px 0 6px", text: "반별 영역 평균" }),
    tableBlock(["반", "n", ...DOMAINS.map(d => d.id + (d.dual ? "(수업 후)" : "")), "Ⅰ 향상"], R.byClassDomain.map(c => [c.cls.replace("-", "학년 ") + "반", c.n, ...c.means.map(m => fmt(m)), fmt(c.gainI)])));
}

function secCuri(R) {
  const C = R.curi;
  return el("section", { class: "sec", id: "curi" },
    el("h2", { text: "큐리 기록과 연결" }),
    el("p", { class: "lead", text: `학년·반·번호가 같은 큐리 개인 제출(가장 최근)과 짝지었어요. 응답 ${C.respondents}명 중 ${C.matched}명이 연결됐어요. 팀 제출은 번호가 없어서 연결되지 않아요.` }),
    tableBlock(["설문 지표", "큐리 지표", "n", "스피어만 ρ", "p"],
      [...C.vars.map(v => ["영역Ⅰ 향상(수업 후−수업 전)", v.label, v.n, fmt(v.rho, 3), fmtP(v.p) + stars(v.p)]),
       ...C.nowI.map(v => ["영역Ⅰ 수업 후 점수", v.label, v.n, fmt(v.rho, 3), fmtP(v.p) + stars(v.p)])], { left: [0, 1] }),
    el("p", { class: "note", text: "큐리 체크 판정은 격려 중심이라 너그럽게 매겨져요. 상관은 '함께 움직이는 경향'으로만 해석해 주세요." }));
}

function secEssay(R) {
  const rows = RES.rows.filter(r => r.essay && (r.essay.first || r.essay.question || r.essay.revised));
  const uncoded = rows.filter(r => !(Array.isArray(r.codes) && r.codes.length));
  const status = el("span", { class: "small" });
  const aiBtn = el("button", { class: "tbtn solid", type: "button", disabled: uncoded.length === 0, text: `AI로 분류하기 (미분류 ${uncoded.length}개)`, onclick: async () => {
    aiBtn.disabled = true;
    let usedRule = 0;
    try {
      for (let i = 0; i < uncoded.length; i += 20) {
        status.textContent = `분류하는 중… ${Math.min(i + 20, uncoded.length)}/${uncoded.length}`;
        const chunk = uncoded.slice(i, i + 20);
        let items;
        try {
          const res = await fetch("api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk.map(r => ({ id: r.id, ...r.essay })) }) });
          if (!res.ok) throw new Error(String(res.status));
          items = ((await res.json()).items || []).map(x => ({ id: x.id, codes: x.codes, source: "ai" }));
          if (!items.length) throw new Error("empty");
        } catch (e) { // AI가 안 되면 단어 규칙으로 초안
          items = chunk.map(r => ({ id: r.id, codes: autoCode(r.essay), source: "auto" })); usedRule += items.length;
        }
        const saved = await rpc("post_survey_save_codes", { pw: PW, items });
        if (saved.error) throw new Error(saved.error);
        for (const x of items) { const r = DATA.rows.find(z => z.id === x.id); if (r) { r.codes = x.codes; r.code_source = x.source; } }
      }
      toast(usedRule ? `AI 연결이 안 돼서 ${usedRule}개는 단어 규칙으로 분류했어요. 확인해 주세요.` : "AI 분류를 마쳤어요. 내용을 보고 수정해 주세요.");
      renderAll(); location.hash = "#essay";
    } catch (e) { status.textContent = "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."; aiBtn.disabled = false; }
  } });
  const saveBtn = el("button", { class: "tbtn", type: "button", disabled: dirtyCodes.size === 0, text: `수정한 분류 저장${dirtyCodes.size ? ` (${dirtyCodes.size})` : ""}`, onclick: async () => {
    saveBtn.disabled = true;
    try {
      const items = [...dirtyCodes.entries()].map(([id, codes]) => ({ id, codes, source: "teacher" }));
      const r = await rpc("post_survey_save_codes", { pw: PW, items });
      if (r.error) throw new Error(r.error);
      for (const x of items) { const d = DATA.rows.find(z => z.id === x.id); if (d) { d.codes = x.codes; d.code_source = "teacher"; } }
      dirtyCodes.clear(); toast("분류를 저장했어요."); renderAll(); location.hash = "#essay";
    } catch (e) { toast("저장하지 못했어요."); saveBtn.disabled = false; }
  } });
  return el("section", { class: "sec", id: "essay" },
    el("h2", { text: "서술형 31번: 무엇이 바뀌었나" }),
    el("p", { class: "lead", text: `서술형에 답한 학생 ${R.essay.n}명 · 분류된 응답 ${R.essay.coded}개. 한 응답에 여러 범주를 고를 수 있어요. AI 분류는 초안이니, 체크를 수정한 뒤 '수정한 분류 저장'을 눌러 주세요.` }),
    tableBlock(["범주", "응답 수", "비율"], R.essay.freq.map(f => [f.code, f.n, R.essay.coded ? `${Math.round(f.n / R.essay.coded * 100)}%` : "–"])),
    el("div", { class: "tools" }, aiBtn, saveBtn, status),
    el("details", { open: true }, el("summary", { style: "cursor:pointer;font-weight:700;margin:8px 0", text: `응답 보기·분류 수정하기 (${rows.length})` }),
      rows.map(r => {
        const codes = new Set(dirtyCodes.has(r.id) ? dirtyCodes.get(r.id) : (r.codes || []));
        return el("div", { class: "essay-card" },
          el("div", { class: "meta", text: `${r.grade}-${r.cls} ${r.num}번 · ${r.at}${r.code_source ? ` · ${r.code_source === "teacher" ? "교사 확인" : r.code_source === "ai" ? "AI 분류" : "단어 규칙 분류"}` : ""}` }),
          el("p", {}, el("b", { text: "① " }), r.essay.first || "—"), el("p", {}, el("b", { text: "② " }), r.essay.question || "—"), el("p", {}, el("b", { text: "③ " }), r.essay.revised || "—"),
          el("div", { class: "codes", role: "group", "aria-label": "분류" }, ESSAY_CODES.map(c => el("label", {}, el("input", { type: "checkbox", checked: codes.has(c), onchange: e => {
            const cur = new Set(dirtyCodes.has(r.id) ? dirtyCodes.get(r.id) : (r.codes || []));
            e.target.checked ? cur.add(c) : cur.delete(c);
            dirtyCodes.set(r.id, ESSAY_CODES.filter(x => cur.has(x)));
            saveBtn.disabled = false; saveBtn.textContent = `수정한 분류 저장 (${dirtyCodes.size})`;
          } }), c))));
      })),
    el("h3", { style: "font-size:15.5px;margin:14px 0 6px", text: "범주별 대표 사례 (최대 3개)" }),
    R.essay.freq.filter(f => f.examples.length).map(f => el("div", {}, el("div", { style: "font-weight:800;margin-top:10px", text: `${f.code} (${f.n})` }),
      f.examples.map(x => el("div", { class: "essay-card" }, el("p", { text: `① ${x.first || "—"}` }), el("p", { text: `② ${x.question || "—"}` }), el("p", { text: `③ ${x.revised || "—"}` }))))));
}

// ── 보고서 문장 (숫자는 모두 계산값) ──
function sentences(R) {
  const out = [];
  const t = R.dual.total;
  if (t.n >= 2) {
    const up = t.diff > 0, sig = t.p < .05;
    out.push(`영역Ⅰ(과학적 의사소통 능력) 전체 평균은 수업 전 M=${fmt(t.m1)}(SD=${fmt(t.sd1)})에서 수업 후 M=${fmt(t.m2)}(SD=${fmt(t.sd2)})로 ${up ? "높아졌으며" : "낮아졌으며"}, 이 차이는 통계적으로 ${sig ? "유의하였다" : "유의하지 않았다"}(t(${t.df})=${fmt(t.t)}, ${pTxt(t.p)}, dz=${fmt(t.dz)}).`);
    const top = [...R.dual.items].filter(i => Number.isFinite(i.diff)).sort((a, b) => b.diff - a.diff).slice(0, 2);
    if (top.length === 2) out.push(`하위요소 중에서는 '${top[0].sub}'(${fmt(top[0].diff)}점, dz=${fmt(top[0].dz)})과 '${top[1].sub}'(${fmt(top[1].diff)}점, dz=${fmt(top[1].dz)})의 향상 폭이 가장 컸다.`);
    const low = [...R.dual.items].filter(i => Number.isFinite(i.diff)).sort((a, b) => a.diff - b.diff)[0];
    if (low) out.push(`향상 폭이 가장 작은 하위요소는 '${low.sub}'(${fmt(low.diff)}점)였다.`);
  }
  const dm = id => R.domains.find(d => d.id === id).now;
  const parts = ["II", "IV", "V"].map(id => { const d = R.domains.find(x => x.id === id); return `${d.short.replace(/^\S+\s/, "")} M=${fmt(dm(id).mean)}`; });
  if (R.N) out.push(`5점 척도 영역 평균은 ${parts.join(", ")}였다(역문항은 역채점).`);
  if (R.pre) {
    const P = R.pre.total, paired = R.pre.method === "paired";
    out.push(`사전 설문과 같은 문항(영역Ⅵ)의 평균은 사전 M=${fmt(P.m1)}에서 사후 M=${fmt(P.m2)}로 ${P.diff > 0 ? "높아졌고" : "낮아졌고"}, ${paired ? "대응표본" : "Welch"} t검정 결과 ${P.p < .05 ? "유의한 차이가 있었다" : "유의한 차이는 없었다"}(t(${fmt(P.df, paired ? 0 : 1)})=${fmt(P.t)}, ${pTxt(P.p)}, ${paired ? "dz" : "d"}=${fmt(paired ? P.dz : P.d)}).`);
  }
  const cv = R.curi.vars.find(v => v.key === "stageGain");
  if (cv && cv.n >= 3) out.push(`큐리 기록과 연결된 ${cv.n}명에서 영역Ⅰ 향상 정도와 큐리 단계별 체크 통과 향상의 스피어만 상관은 ρ=${fmt(cv.rho, 2)}(${pTxt(cv.p)})였다.`);
  if (R.essay.coded) {
    const f = [...R.essay.freq].filter(x => x.code !== "기타").sort((a, b) => b.n - a.n);
    out.push(`서술형(31번) ${R.essay.coded}개 응답에서 AI의 질문을 받고 가장 많이 수정한 부분은 '${f[0].code}'(${f[0].n}개, ${Math.round(f[0].n / R.essay.coded * 100)}%)였고, 다음은 '${f[1].code}'(${f[1].n}개)였다.`);
  }
  return out;
}

function exportXlsx(R) {
  const allItems = DOMAINS.flatMap(d => d.items.map(it => ({ ...it, dual: !!d.dual })));
  const head = ["학년", "반", "번호", "제출 시각", "AI 문제 풀기", "큐리 탐구", ...allItems.flatMap(it => it.dual ? [`${it.n}_수업전`, `${it.n}_수업후`] : [`${it.n}${it.reverse ? "(원점수)" : ""}`]), "31_①처음", "31_②질문", "31_③수정한것", "31_분류"];
  const raw = [head, ...R.rows.map(r => [r.grade, r.cls, r.num, r.at, r.act_ai ? "예" : "아니오", r.act_curi ? "예" : "아니오",
    ...allItems.flatMap(it => { const a = r.answers[it.n] ?? r.answers[String(it.n)]; return it.dual ? [a ? a.pre : "", a ? a.now : ""] : [a ?? "해당 없음"]; }),
    r.essay.first || "", r.essay.question || "", r.essay.revised || "", (r.codes || []).join(", ")])];
  const r2 = v => Number.isFinite(v) ? Math.round(v * 100) / 100 : "";
  const per = [["학년", "반", "번호", "제출 시각", "AI 문제 풀기", "큐리 탐구", "Ⅰ 수업 전 평균", "Ⅰ 수업 후 평균", "Ⅰ 향상(후−전)", ...DOMAINS.filter(d => !d.dual).map(d => `${d.short} 평균`), "31 분류"],
    ...R.rows.map(r => { const D1 = DOMAINS[0], pre = domainScore(r, D1, "pre"), now = domainScore(r, D1, "now");
      return [r.grade, r.cls, r.num, r.at, r.act_ai ? "예" : "아니오", r.act_curi ? "예" : "아니오", r2(pre), r2(now), r2(now - pre), ...DOMAINS.filter(d => !d.dual).map(d => r2(domainScore(r, d, "now"))), (r.codes || []).join(", ")]; })];
  const summ = [["영역", "구분", "n", "평균", "표준편차", "Cronbach α"]];
  for (const d of R.domains) for (const w of d.dual ? ["pre", "now"] : ["now"]) summ.push([d.name, d.dual ? (w === "pre" ? "수업 전" : "수업 후") : "", d[w].n, +fmt(d[w].mean, 3), +fmt(d[w].sd, 3), Number.isFinite(d[w].alpha.alpha) ? +fmt(d[w].alpha.alpha, 3) : ""]);
  summ.push([]); summ.push(["번호", "문항", "역채점", "구분", "n", "평균", "표준편차", "1", "2", "3", "4", "5"]);
  for (const d of R.domains) for (const it of d.items) for (const w of d.dual ? ["pre", "now"] : ["now"]) summ.push([it.n, it.t, it.reverse ? "예" : "", d.dual ? (w === "pre" ? "수업 전" : "수업 후") : "", it[w].n, +fmt(it[w].mean, 3), +fmt(it[w].sd, 3), ...it[w].dist]);
  const tt = [["분석", "문항", "n", "평균1", "SD1", "평균2", "SD2", "차이", "t", "df", "p", "효과크기"]];
  for (const i of R.dual.items) tt.push(["영역Ⅰ 수업 전 vs 수업 후(대응)", `${i.num}. ${i.sub}`, i.n, +fmt(i.m1, 3), +fmt(i.sd1, 3), +fmt(i.m2, 3), +fmt(i.sd2, 3), +fmt(i.diff, 3), +fmt(i.t, 3), i.df, +i.p.toPrecision(4), +fmt(i.dz, 3)]);
  const T = R.dual.total; tt.push(["영역Ⅰ 수업 전 vs 수업 후(대응)", "영역 평균", T.n, +fmt(T.m1, 3), +fmt(T.sd1, 3), +fmt(T.m2, 3), +fmt(T.sd2, 3), +fmt(T.diff, 3), +fmt(T.t, 3), T.df, +T.p.toPrecision(4), +fmt(T.dz, 3)]);
  if (R.pre) { const pd = R.pre.method === "paired"; for (const i of [...R.pre.items, { ...R.pre.total, post: "영역Ⅵ 평균", pre: "" }]) tt.push([`영역Ⅵ 사전 vs 사후(${pd ? "대응" : "Welch"})`, `${i.post}${i.pre ? ` (사전 ${i.pre})` : ""}`, pd ? i.n : `${i.n1}/${i.n2}`, +fmt(i.m1, 3), +fmt(i.sd1, 3), +fmt(i.m2, 3), +fmt(i.sd2, 3), +fmt(i.diff, 3), +fmt(i.t, 3), +fmt(i.df, 2), +i.p.toPrecision(4), +fmt(pd ? i.dz : i.d, 3)]); }
  for (const v of R.curi.vars) tt.push(["큐리 연결(스피어만)", `영역Ⅰ 향상 × ${v.label}`, v.n, "", "", "", "", "", "", "", Number.isFinite(v.p) ? +v.p.toPrecision(4) : "", Number.isFinite(v.rho) ? +fmt(v.rho, 3) : ""]);
  const es = [["학년", "반", "번호", "①처음", "②질문", "③수정한것", ...ESSAY_CODES, "분류 출처"], ...R.rows.filter(r => r.essay && (r.essay.first || r.essay.question || r.essay.revised)).map(r => [r.grade, r.cls, r.num, r.essay.first || "", r.essay.question || "", r.essay.revised || "", ...ESSAY_CODES.map(c => (r.codes || []).includes(c) ? 1 : 0), r.code_source || ""])];
  const blob = makeXlsx([{ name: "학생별 점수", rows: per }, { name: "원자료", rows: raw }, { name: "영역별 요약", rows: summ }, { name: "t검정·상관", rows: tt }, { name: "서술형 분류", rows: es }]);
  const a = el("a", { href: URL.createObjectURL(blob), download: `사후설문_분석_${DATA.at.replace(/[ :]/g, "-")}.xlsx` });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function secReport(R) {
  const s = sentences(R);
  const all = s.join(" ");
  return el("section", { class: "sec", id: "report" },
    el("h2", { text: "보고서 문장 초안·내보내기" }),
    el("p", { class: "lead", text: "문장의 숫자는 위 표의 계산값으로만 채워져요. 표현은 보고서에 맞게 다듬어 주세요." }),
    s.length ? s.map(x => el("div", { class: "sentence", text: x })) : el("p", { class: "small", text: "응답이 쌓이면 문장이 만들어져요." }),
    el("div", { class: "tools" },
      el("button", { class: "tbtn", type: "button", disabled: !s.length, onclick: async () => { try { await navigator.clipboard.writeText(all); toast("문장을 복사했어요."); } catch (e) { toast("복사하지 못했어요."); } }, text: "문장 모두 복사" }),
      el("button", { class: "tbtn solid", type: "button", disabled: !R.N, onclick: () => exportXlsx(R), text: "📥 학생 결과 엑셀로 내려받기" })),
    el("p", { class: "note", text: "엑셀 시트: 학생별 점수(영역 평균, 역채점 반영) · 원자료(원점수) · 영역별 요약 · t검정·상관 · 서술형 분류. 학생 이름은 들어 있지 않아요." }));
}

// 시작
const saved = ss.get(PW_KEY);
if (saved) load(saved); else renderLogin();
