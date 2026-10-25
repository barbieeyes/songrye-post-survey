// 서술형 36번 '무엇이 바뀌었나' 자동 분류 초안 (규칙 기반, 서버·AI 없이 브라우저에서)
// ①처음 → ③수정한 것 사이에 새로 생긴 표현과 ②질문의 내용을 보고 범주를 고릅니다. 교사가 화면에서 수정할 수 있어요.
const TERMS = ["위치에너지", "위치 에너지", "운동에너지", "운동 에너지", "역학적 에너지", "역학적에너지", "열에너지", "열 에너지", "에너지 보존", "에너지 전환", "속력", "속도", "가속도", "중력", "질량", "마찰", "공기저항", "공기 저항", "독립변인", "종속변인", "통제변인", "변인", "자유낙하", "높이", "일의 양"];
const UNIT = /(\d\s*(m\/s|km\/h|kg|g\b|J\b|N\b|m\b|cm|s\b|초|미터|줄|킬로그램))|단위/;
const EVID = /(측정|측정값|값이|그래프|표에|표를|자료|결과|실험에서|데이터|수치|\d+(\.\d+)?)/;
const REASON = /(왜냐하면|때문|원리|보존|전환|바뀌어|바뀌기|이유|그래서|따라서|~므로|므로)/;
const STEPS = /(먼저|다음|그다음|그 다음|순서|단계|과정|마지막|①|②|1\.|2\.|첫째|둘째)/;

const has = (s, re) => re.test(s || "");
const newTerm = (a, b) => TERMS.some(t => (b || "").includes(t) && !(a || "").includes(t));
const count = (s, re) => ((s || "").match(new RegExp(re.source, "g")) || []).length;

export function autoCode(essay) {
  const a = essay.first || "", q = essay.question || "", b = essay.revised || "";
  const codes = new Set();
  if (newTerm(a, b) || (count(b, UNIT) > count(a, UNIT)) || /(용어|단위|어떤 에너지|무슨 에너지)/.test(q)) codes.add("용어·단위");
  if (count(b, EVID) > count(a, EVID) || /(근거|측정|자료|그래프|값)/.test(q)) codes.add("근거·자료");
  if ((has(b, REASON) && !has(a, REASON)) || /(왜|이유|원리)/.test(q)) codes.add("원리·이유");
  if ((has(b, STEPS) && !has(a, STEPS)) || /(순서|과정|단계)/.test(q)) codes.add("사고 과정·순서");
  if (!codes.size) codes.add("기타");
  return ["용어·단위", "근거·자료", "원리·이유", "사고 과정·순서", "기타"].filter(c => codes.has(c));
}
