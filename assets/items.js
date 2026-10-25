// 사후 설문 문항 — 문구는 설문지(사후검사_설문지)와 한 글자도 다르지 않게 유지
export const APP_VERSION = "2026-10-25a";
// 구글 스프레드시트(Apps Script 웹 앱) 주소 — 비어 있으면 시트로는 보내지 않음
export const SHEET_URL = "";
export const SUPABASE_URL = "https://hcvaaxxwqqrbpnloyjzr.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdmFheHh3cXFyYnBubG95anpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjI1MTgsImV4cCI6MjEwMTU5ODUxOH0.8TKT8aExXiyazDY313G9BHTvZCSu2yrTdxlgwxpNCB8"; // 공개용 anon 키 (RLS: 추가만 가능)

export const SCALE = ["전혀 그렇지 않다", "그렇지 않다", "보통이다", "그렇다", "매우 그렇다"];

export const INTRO = "본 설문지는 이번 학기 AI와 문답하며 오류를 찾아 수정하는 과학 수업이 여러분의 과학적 의사소통 능력에 어떤 도움을 주었는지 알아보기 위한 연구의 사후 검사입니다. 수집된 자료는 연구 목적으로만 사용되며 성적과 관계없고 익명으로 처리됩니다. 정답이 있는 검사가 아니므로 솔직하게 응답해 주시기 바랍니다.";

export const ACT_AI = "AI와 문답하며 과학 문제 풀기";
export const ACT_CURI = "큐리로 탐구 보고서 쓰기";

// dual: 수업 전/지금 두 번 응답 · reverse: 역채점(학생 화면엔 표시하지 않음) · aiOnly: AI 문제 풀기를 한 학생만 · pre: 사전 설문 번호 · sub: 하위요소
export const DOMAINS = [
  { id: "I", name: "영역Ⅰ. 과학적 의사소통 능력의 변화", short: "Ⅰ 과학적 의사소통", dual: true, color: "#DCE9F8", icon: "💬", accent: "#3D7BE0",
    guide: "각 문항마다 '수업 전의 나'와 '수업 후의 나'를 각각 골라 주세요.",
    items: [
      { n: 1, t: "나는 과학 용어를 정확하게 사용해 내 생각을 표현할 수 있다.", sub: "용어" },
      { n: 2, t: "나는 숫자에 알맞은 단위를 붙여 정확하게 쓸 수 있다.", sub: "단위" },
      { n: 3, t: "나는 그래프·표·측정값 같은 자료를 해석해 그 의미를 설명할 수 있다.", sub: "자료 해석" },
      { n: 4, t: "나는 내 주장에 측정값이나 자료를 근거로 들 수 있다.", sub: "근거" },
      { n: 5, t: "나는 왜 그런 결과가 나왔는지 과학 원리로 이유를 설명할 수 있다.", sub: "원리" },
      { n: 6, t: "나는 풀이나 탐구 과정을 다른 사람이 따라올 수 있게 순서대로 설명할 수 있다.", sub: "사고 과정 표현" },
      { n: 7, t: "나는 질문이나 피드백을 받으면 내 설명을 수정해 더 정확하게 만들 수 있다.", sub: "수정·정교화" },
      { n: 8, t: "나는 실험을 해 보지 않은 친구도 이해할 수 있게 설명할 수 있다.", sub: "전달" }
    ] },
  { id: "II", name: "영역Ⅱ. 큐리와의 문답과 피드백", short: "Ⅱ 문답·피드백", color: "#FFE6D5", icon: "💡", accent: "#E0662B",
    items: [
      { n: 9, t: "큐리와 묻고 답하며 내 생각을 말하거나 설명할 기회가 많았다.", sub: "의사소통 기회" },
      { n: 10, t: "큐리의 평가를 보고 내 생각이나 글이 어디까지 맞았는지 알 수 있었다.", sub: "평가" },
      { n: 11, t: "큐리가 다시 질문하면, 그 질문에 답하면서 내 생각을 다시 정리하게 되었다.", sub: "질문형 피드백" },
      { n: 12, t: "큐리를 사용하면서 내가 잘하고 있는지 헷갈리는 일이 줄었다.", sub: "확신" },
      { n: 13, t: "큐리와 주고받은 대화가 선생님이나 친구와 이야기하며 배우는 것처럼 느껴졌다.", sub: "대화 상대" }
    ] },
  { id: "III", name: "영역Ⅲ. 오류 분석과 자기 수정", short: "Ⅲ 오류 분석·자기 수정", color: "#DFF0D8", icon: "🔍", accent: "#1E9E5A",
    items: [
      { n: 14, t: "AI의 질문을 받고 내 풀이나 글에서 틀린 부분을 스스로 찾아냈다." },
      { n: 15, t: "AI가 정답 대신 질문을 해서, 내 생각을 다시 점검하게 되었다." },
      { n: 16, t: "이제는 AI가 없어도 내 답을 스스로 다시 점검하는 습관이 생겼다." },
      { n: 17, t: "AI가 답을 바로 알려 주지 않아서 답답하거나 포기하고 싶었다.", reverse: true }
    ] },
  { id: "IV", name: "영역Ⅳ. 문답형 AI로 과학 문제 해결", short: "Ⅳ 문답형 AI 문제 해결", color: "#FBF1C9", icon: "🤖", accent: "#C77A00", aiOnly: true,
    items: [
      { n: 18, t: "화이트보드나 음성으로 풀이 과정을 설명하면서 내 생각이 정리되었다." },
      { n: 19, t: "AI의 질문이 단계를 나눠 주어 어려운 문제도 끝까지 풀 수 있었다." },
      { n: 20, t: "답뿐 아니라 풀이 과정과 이유를 설명하는 것이 중요하다는 것을 알게 되었다." }
    ] },
  { id: "V", name: "영역Ⅴ. 큐리와 함께한 과학 탐구", short: "Ⅴ 큐리 탐구", color: "#E8E0F5", icon: "🧪", accent: "#7B4FD0",
    items: [
      { n: 21, t: "큐리와 대화하며 '바꿀 것'과 '잴 것'이 드러나는 탐구 질문을 만들 수 있었다." },
      { n: 22, t: "독립·종속·통제변인을 구분해 공정한 실험을 설계할 수 있었다." },
      { n: 23, t: "실험실에서 조건을 바꿔 측정한 값으로 규칙을 찾을 수 있었다." },
      { n: 24, t: "결론을 주장, 근거(측정값), 원리(에너지)로 나누어 쓸 수 있었다." },
      { n: 25, t: "큐리가 \"어떤 에너지야?\", \"단위는?\"처럼 되물어서 과학 용어와 단위를 수정해 쓰게 되었다." }
    ] },
  { id: "VI", name: "영역Ⅵ. 교수·학습 과정과 교육과정", short: "Ⅵ 교수·학습 과정", color: "#F9DDE5", icon: "🧭", accent: "#D2456E",
    items: [
      { n: 26, t: "AI와 문답하며 문제를 풀던 경험이 큐리로 탐구 보고서를 쓸 때 도움이 되었다.", aiOnly: true },
      { n: 27, t: "'내 생각 먼저 쓰기 → AI 질문 확인 → 다시 생각하기 → 수정하기' 순서의 수업이 나에게 잘 맞았다." },
      { n: 28, t: "이번 수업을 통해 '운동과 에너지' 단원 내용을 더 깊이 이해하게 되었다." },
      { n: 29, t: "나는 AI의 답이나 피드백을 그대로 받아들이지 않고, 근거가 맞는지 따져 보았다." }
    ] },
  { id: "VII", name: "영역Ⅶ. 과학 활동 경험과 어려움", short: "Ⅶ 경험과 어려움", color: "#DCEBF5", icon: "📚", accent: "#1A8FA8", preCompare: true,
    items: [
      { n: 30, t: "나는 실험이나 조사 활동 후 결과를 친구들에게 설명하거나 발표해 본 경험이 있다.", pre: 8 },
      { n: 31, t: "나는 조사하거나 실험한 내용을 글이나 자료로 정리해 본 경험이 있다.", pre: 9 },
      { n: 32, t: "나는 무엇을 알아보면 좋을지 스스로 정하는 것이 어렵다.", pre: 16, reverse: true },
      { n: 33, t: "나는 조사나 실험 결과를 이유나 근거를 들어 설명하는 것이 어렵다.", pre: 18, reverse: true },
      { n: 34, t: "나는 내가 알아본 내용을 다른 사람에게 설명하는 것이 어렵다.", pre: 19, reverse: true },
      { n: 35, t: "나는 활동을 하면서 내 생각이나 방법이 맞는지 피드백을 받는 것이 도움이 된다.", pre: 21 }
    ] }
];

export const ESSAY = {
  n: 36,
  t: "AI(문제 풀이 AI 또는 큐리)의 질문을 받고 내 생각이나 글을 수정한 경험을 하나 떠올려 주세요. ① 처음에 어떻게 썼는지, ② 어떤 질문을 받았는지, ③ 어떻게 수정했는지 순서대로 적어 주세요.",
  parts: [
    { key: "first", label: "① 처음에 쓴 것" },
    { key: "question", label: "② 받은 질문" },
    { key: "revised", label: "③ 수정한 것" }
  ]
};

export const ESSAY_CODES = ["용어·단위", "근거·자료", "원리·이유", "사고 과정·순서", "기타"];

export const ALL_ITEMS = DOMAINS.flatMap(d => d.items.map(it => ({ ...it, domain: d.id, dual: !!d.dual, aiOnly: !!(d.aiOnly || it.aiOnly) })));
export const REVERSE = ALL_ITEMS.filter(i => i.reverse).map(i => i.n); // [17, 32, 33, 34]
export const PRE_DOMAIN = DOMAINS.find(d => d.preCompare); // 사전 설문과 같은 문항 영역
export const AI_DOMAIN = DOMAINS.find(d => d.aiOnly); // AI 문제 풀기 한 학생만
export const AI_ONLY_ITEMS = ALL_ITEMS.filter(i => i.aiOnly && !AI_DOMAIN.items.some(x => x.n === i.n)).map(i => i.n);
export const N_ITEMS = ALL_ITEMS.length;

// 학생 화면에 보여 줄 영역 (AI 문제 풀기를 안 한 학생은 영역Ⅲ과 21번 제외)
export function visibleDomains(actAi) {
  return DOMAINS.map(d => ({ ...d, items: d.items.filter(it => actAi || !(d.aiOnly || it.aiOnly)) })).filter(d => d.items.length > 0);
}

// 서술형 문항 설정(교사용 화면에서 수정) — 못 불러오면 기본 문구 사용
export const DEFAULT_ESSAY_CFG = { question: ESSAY.t, labels: ESSAY.parts.map(p => p.label) };
export async function loadEssayConfig() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/post_survey_config?id=eq.1&select=essay,updated_at`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error(String(res.status));
    const rows = await res.json();
    const e = rows && rows[0] && rows[0].essay;
    if (!e || !e.question || !Array.isArray(e.labels) || e.labels.length !== 3) throw new Error("bad");
    return { question: String(e.question), labels: e.labels.map(String), updated_at: rows[0].updated_at };
  } catch (err) { return { ...DEFAULT_ESSAY_CFG, fallback: true }; }
}
