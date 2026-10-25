import { APP_VERSION, SUPABASE_URL, SUPABASE_KEY, SHEET_URL, SCALE, INTRO, CONSENT, ACT_AI, ACT_CURI, ESSAY, visibleDomains, ALL_ITEMS, loadEssayConfig, DEFAULT_ESSAY_CFG } from "./items.js?v=20261025c";
let ESSAY_CFG = DEFAULT_ESSAY_CFG;

const DRAFT_KEY = "post-survey-draft-v2";
const DONE_KEY = "post-survey-done-v2";
const $app = document.getElementById("app");
const $prev = document.getElementById("prev");
const $next = document.getElementById("next");
const $bar = document.getElementById("bar");
const $barLabel = document.getElementById("barLabel");

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

let S = store.get(DRAFT_KEY) || { step: 0, grade: "", cls: "", num: "", actAi: false, actCuri: false, ans: {}, essay: { first: "", question: "", revised: "" } };
let submitting = false;
const save = () => store.set(DRAFT_KEY, S);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.setAttribute("style", v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(5)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

// 화면 순서: 0 시작 → 영역들 → 서술형 → (제출)
const domains = () => visibleDomains(S.actAi);
const steps = () => ["start", ...domains().map(d => d.id), "essay"];

function setProgress() {
  const st = steps();
  const i = Math.min(S.step, st.length - 1);
  $bar.style.width = `${Math.round((i / (st.length - 1)) * 100)}%`;
  const d = domains().find(x => x.id === st[i]);
  $barLabel.textContent = i === 0 ? "시작" : st[i] === "essay" ? `✏️ 마지막 단계 · ${i} / ${st.length - 1}` : `${d ? d.icon + " " : ""}${i} / ${st.length - 1}`;
}

function likert(name, value, onPick, labelId) {
  return el("div", { class: "scale", role: "radiogroup", "aria-labelledby": labelId },
    SCALE.map((lab, i) => {
      const v = i + 1;
      const id = `${name}-${v}`;
      return el("label", { class: "opt", for: id },
        el("input", { type: "radio", id, name, value: String(v), checked: value === v, onchange: () => onPick(v) }),
        el("span", { class: `s${v}` }, el("b", { text: String(v) }), el("small", { text: lab })));
    }));
}

function renderStart() {
  const sel = (id, label, max, val, key) => el("div", { class: "field" },
    el("label", { for: id, text: label }),
    el("select", { id, onchange: e => { S[key] = e.target.value; save(); } },
      el("option", { value: "", text: "선택" }),
      Array.from({ length: max }, (_, i) => el("option", { value: String(i + 1), selected: String(i + 1) === String(val), text: `${i + 1}` }))));
  const chk = (id, label, key) => el("label", { class: "check", for: id },
    el("input", { type: "checkbox", id, checked: S[key], onchange: e => { S[key] = e.target.checked; save(); } }), el("span", { text: label }));
  return [
    el("h1", { text: "AI 기반 오류 분석 학습이 중학생의 과학적 의사소통 능력에 미치는 영향 (사후 검사 설문지)" }),
    el("div", { class: "card intro", text: INTRO }),
    el("div", { class: "card" },
      el("h2", {}, el("span", { "aria-hidden": "true", text: "🙋 " }), "나의 정보"),
      el("div", { class: "row" }, sel("grade", "학년", 3, S.grade, "grade"), sel("cls", "반", 15, S.cls, "cls"), sel("num", "번호", 35, S.num, "num")),
      el("div", { class: "field name-field" }, el("label", { for: "name", text: "이름" }),
        el("input", { id: "name", type: "text", maxlength: "20", autocomplete: "name", value: S.name || "", placeholder: "이름을 써 주세요", oninput: e => { S.name = e.target.value; save(); } })),
      el("div", { class: "consent" },
        el("h3", { text: "[필수] 개인정보 수집·이용 동의" }),
        el("ul", {}, ...CONSENT.items.map(([k, v]) => el("li", {}, el("b", { text: `${k}: ` }), v))),
        el("p", { class: "small", text: CONSENT.note }),
        el("label", { class: "check", for: "consent" },
          el("input", { type: "checkbox", id: "consent", checked: !!S.consent, onchange: e => { S.consent = e.target.checked; save(); } }),
          el("span", { text: CONSENT.label }))),
      el("div", { id: "startErr" })),
    el("div", { class: "card" },
      el("h2", {}, el("span", { "aria-hidden": "true", text: "🎒 " }), "이번 학기에 참여한 활동"),
      el("p", { class: "small", text: "해당하는 것을 모두 골라 주세요." }),
      chk("actAi", ACT_AI, "actAi"), chk("actCuri", ACT_CURI, "actCuri"))
  ];
}

function itemBlock(it, dual) {
  const legendId = `lg-${it.n}`;
  const fs = el("fieldset", { class: "q", id: `q-${it.n}`, "aria-labelledby": legendId },
    el("div", { class: "qtitle", id: legendId }, el("span", { class: "num", text: `${it.n}` }), it.t));
  if (dual) {
    const cur = S.ans[it.n] || {};
    for (const [k, lab] of [["pre", "수업 전의 나"], ["now", "수업 후의 나"]]) {
      const subId = `sl-${it.n}-${k}`;
      fs.append(el("div", { class: `when when-${k}` },
        el("div", { class: "sub-label", id: subId }, el("span", { class: "when-tag", text: k === "pre" ? "BEFORE" : "AFTER" }), lab),
        likert(`a${it.n}${k}`, cur[k], v => { S.ans[it.n] = { ...(S.ans[it.n] || {}), [k]: v }; save(); clearMiss(fs, it, true); }, `${legendId} ${subId}`)));
    }
  } else {
    fs.append(likert(`a${it.n}`, S.ans[it.n], v => { S.ans[it.n] = v; save(); clearMiss(fs, it, false); }, legendId));
  }
  fs.append(el("div", { class: "miss-msg", role: "alert", text: dual ? "수업 전과 수업 후를 모두 골라 주세요." : "이 문항을 골라 주세요." }));
  return fs;
}
function answered(it, dual) {
  const a = S.ans[it.n];
  return dual ? !!(a && a.pre && a.now) : Number.isInteger(a);
}
function clearMiss(fs, it, dual) { if (answered(it, dual)) fs.classList.remove("missing"); }

function renderDomain(d) {
  return [
    el("div", { class: "dom-head", style: `background:${d.color};--acc:${d.accent}` },
      el("div", { class: "dom-ico", "aria-hidden": "true", text: d.icon }),
      el("div", {}, el("h2", { text: d.name }), d.guide ? el("div", { class: "guide", text: d.guide }) : null)),
    d.items.map(it => { const b = itemBlock(it, !!d.dual); b.style.setProperty("--acc", d.accent); return b; })
  ];
}

function renderEssay() {
  return [
    el("div", { class: "dom-head", style: "background:#FCE6CF;--acc:#D9692A" }, el("div", { class: "dom-ico", "aria-hidden": "true", text: "✏️" }), el("div", {}, el("h2", { text: "서술형" }), el("div", { class: "guide", text: "마지막이에요! 내 경험을 떠올려 적어 주세요." }))),
    el("div", { class: "card" },
      el("p", { class: "intro", style: "margin:0;white-space:pre-line" }, el("b", { style: "color:var(--primary)", text: `${ESSAY.n}. ` }), ESSAY_CFG.question),
      ESSAY.parts.map((p, i) => ESSAY_CFG.labels[i] ? [
        el("label", { class: "essay-label", for: `es-${p.key}`, text: ESSAY_CFG.labels[i] }),
        el("textarea", { id: `es-${p.key}`, maxlength: "1500", oninput: e => { S.essay[p.key] = e.target.value; save(); } }, S.essay[p.key] || "")
      ] : null)),
    el("div", { id: "submitMsg" })
  ];
}

function renderDone(info) {
  setProgressDone();
  $app.replaceChildren(el("div", { class: "done" },
    el("div", { class: "big", "aria-hidden": "true", text: "🎉" }),
    el("h1", { text: "제출했어요. 고마워요!" }),
    el("p", { class: "small", text: `${info.grade}학년 ${info.cls}반 ${info.num}번 · ${info.at}` }),
    el("p", { class: "small", text: "잘못 낸 것이 있으면 아래를 눌러 다시 낼 수 있어요. 선생님은 가장 마지막에 낸 응답만 봐요." }),
    el("button", { class: "link-btn", type: "button", onclick: () => { store.del(DONE_KEY); S.step = 0; save(); render(); } , text: "다시 내기" })));
  document.getElementById("nav").style.display = "none";
}
function setProgressDone() { $bar.style.width = "100%"; $barLabel.textContent = "제출 완료"; }

function render() {
  const done = store.get(DONE_KEY);
  if (done) return renderDone(done);
  document.getElementById("nav").style.display = "";
  const st = steps();
  if (S.step >= st.length) S.step = st.length - 1;
  const cur = st[S.step];
  let nodes;
  if (cur === "start") nodes = renderStart();
  else if (cur === "essay") nodes = renderEssay();
  else nodes = renderDomain(domains().find(d => d.id === cur));
  $app.replaceChildren(...[nodes].flat(3).filter(Boolean));
  $prev.style.visibility = S.step === 0 ? "hidden" : "visible";
  $next.textContent = cur === "essay" ? "제출하기" : cur === "start" ? "시작하기" : "다음";
  $next.disabled = false;
  setProgress();
  window.scrollTo(0, 0);
}

function validateCurrent() {
  const cur = steps()[S.step];
  if (cur === "start") {
    const box = document.getElementById("startErr");
    if (!S.grade || !S.cls || !S.num) { box.replaceChildren(el("div", { class: "alert err", role: "alert", text: "학년, 반, 번호를 모두 골라 주세요." })); return false; }
    if (!String(S.name || "").trim()) { box.replaceChildren(el("div", { class: "alert err", role: "alert", text: "이름을 써 주세요." })); document.getElementById("name").focus(); return false; }
    if (!S.consent) { box.replaceChildren(el("div", { class: "alert err", role: "alert", text: "개인정보 수집·이용에 동의해야 설문을 시작할 수 있어요." })); document.getElementById("consent").focus(); return false; }
    box.replaceChildren();
    return true;
  }
  if (cur === "essay") return true;
  const d = domains().find(x => x.id === cur);
  let first = null;
  for (const it of d.items) {
    const fs = document.getElementById(`q-${it.n}`);
    if (!answered(it, !!d.dual)) { fs.classList.add("missing"); if (!first) first = fs; } else fs.classList.remove("missing");
  }
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    const inp = first.querySelector("input"); if (inp) inp.focus({ preventScroll: true });
    return false;
  }
  return true;
}

function buildPayload() {
  const vis = new Set(domains().flatMap(d => d.items.map(i => i.n)));
  const answers = {};
  for (const it of ALL_ITEMS) {
    if (!vis.has(it.n)) { answers[it.n] = null; continue; } // 해당 없음
    const a = S.ans[it.n];
    answers[it.n] = it.dual ? { pre: a.pre, now: a.now } : a;
  }
  const trim = s => String(s || "").trim().slice(0, 1500);
  return {
    grade: Number(S.grade), cls: Number(S.cls), num: Number(S.num), name: String(S.name || "").trim().slice(0, 20), consent: !!S.consent,
    act_ai: !!S.actAi, act_curi: !!S.actCuri, answers,
    essay: { first: trim(S.essay.first), question: trim(S.essay.question), revised: trim(S.essay.revised), prompt: ESSAY_CFG.question.slice(0, 600), labels: ESSAY_CFG.labels },
    app_version: APP_VERSION
  };
}

async function submit() {
  if (submitting) return;
  // 모든 영역이 다 찼는지 마지막으로 확인
  for (let i = 1; i < steps().length - 1; i++) {
    const d = domains()[i - 1];
    if (!d.items.every(it => answered(it, !!d.dual))) { S.step = i; save(); render(); validateCurrent(); return; }
  }
  submitting = true; $next.disabled = true; $next.textContent = "보내는 중…";
  const msg = document.getElementById("submitMsg");
  const body = JSON.stringify(buildPayload());
  const send = () => fetch(`${SUPABASE_URL}/rest/v1/post_survey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "return=minimal" },
    body
  });
  try {
    let res = await send().catch(() => null);
    if (!res || !res.ok) { await new Promise(r => setTimeout(r, 1200)); res = await send(); }
    if (!res.ok) throw new Error(String(res.status));
    if (SHEET_URL) { // 구글 시트에도 한 줄 (실패해도 제출은 완료로 봄 — 원본은 데이터베이스)
      await Promise.race([fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }).catch(() => null), new Promise(r => setTimeout(r, 4000))]);
    }
    const now = new Date();
    const info = { grade: S.grade, cls: S.cls, num: S.num, at: `${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` };
    store.set(DONE_KEY, info);
    store.del(DRAFT_KEY);
    S = { step: 0, grade: S.grade, cls: S.cls, num: S.num, name: S.name, consent: S.consent, actAi: false, actCuri: false, ans: {}, essay: { first: "", question: "", revised: "" } };
    renderDone(info);
  } catch (e) {
    msg.replaceChildren(el("div", { class: "alert err", role: "alert", text: "보내지 못했어요. 인터넷 연결을 확인하고 '제출하기'를 다시 눌러 주세요. 쓴 내용은 그대로 남아 있어요." }));
    $next.disabled = false; $next.textContent = "제출하기";
  } finally { submitting = false; }
}

$next.addEventListener("click", () => {
  if (!validateCurrent()) return;
  if (steps()[S.step] === "essay") return submit();
  S.step += 1; save(); render();
});
$prev.addEventListener("click", () => { if (S.step > 0) { S.step -= 1; save(); render(); } });

render();
loadEssayConfig().then(c => { ESSAY_CFG = c; if (steps()[S.step] === "essay" && !store.get(DONE_KEY)) render(); });
