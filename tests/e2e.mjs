// 학생 설문 흐름 + 교사 분석 화면 전체 테스트 (Supabase·AI는 흉내)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = createServer((req, res) => {
  let p = req.url.split("?")[0]; if (p === "/") p = "/index.html"; if (p === "/teacher") p = "/teacher.html";
  const f = ROOT + p.slice(1); if (!existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": TYPES[p.slice(p.lastIndexOf("."))] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(4300);
mkdirSync(ROOT + "tests/shots", { recursive: true });
const FAKE = JSON.parse(readFileSync(ROOT + "tests/fake.json", "utf8"));
const EXP = JSON.parse(readFileSync(ROOT + "tests/expected.json", "utf8"));
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ok = 0, bad = 0;
const t = (c, m) => { c ? ok++ : bad++; console.log(c ? "✅" : "❌", m); };
const near = (a, b, tol = 0.011) => Math.abs(Number(a) - Number(b)) <= tol;
const block = route => route.fulfill({ status: 200, body: "" }); // 외부 글꼴 차단
let CFG = { question: "기본 서술형 질문입니다", labels: ["① 처음에 쓴 것", "② 받은 질문", "③ 수정한 것"] };
const cfgRoute = ctx => ctx.route(/rest\/v1\/post_survey_config/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ essay: CFG, updated_at: "2026-10-22T05:00:00Z" }]) }));

// ── 학생 화면 ──
async function student(vp, actAi) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 500 });
  await ctx.route(/jsdelivr/, block); await cfgRoute(ctx);
  const posted = [];
  let failNext = 0;
  await ctx.route(/supabase\.co\/rest\/v1\/post_survey($|\?)/, async r => { if (failNext > 0) { failNext--; return r.fulfill({ status: 500, body: "x" }); } posted.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 201, body: "" }); });
  const pg = await ctx.newPage(); pg.on("pageerror", e => t(false, "pageerror " + e.message));
  await pg.goto("http://localhost:4300/"); await sleep(300);
  t(await pg.getByText("사후 검사입니다").isVisible(), `${vp.width}: 안내문 보임`);
  await pg.getByRole("button", { name: "시작하기" }).click(); await sleep(100);
  t(await pg.getByRole("alert").filter({ hasText: "학년, 반, 번호" }).isVisible(), "학번 안 고르면 막음");
  await pg.selectOption("#grade", "3"); await pg.selectOption("#cls", "2"); await pg.selectOption("#num", "14");
  if (actAi) await pg.getByLabel("AI와 문답하며 과학 문제 풀기").check();
  await pg.getByLabel("큐리로 탐구 보고서 쓰기").check();
  await pg.getByRole("button", { name: "시작하기" }).click(); await sleep(200);
  t(await pg.getByRole("heading", { name: /영역Ⅰ/ }).isVisible(), "영역Ⅰ 화면");
  t((await pg.locator(".when-pre", { hasText: "수업 전의 나" }).count()) === 8 && (await pg.locator(".when-now", { hasText: "수업 후의 나" }).count()) === 8, "영역Ⅰ 8문항 × 수업 전/수업 후 (색으로 구분)");
  await pg.getByRole("button", { name: "다음" }).click(); await sleep(400);
  t(await pg.locator("#q-1.missing").count() === 1 && await pg.getByRole("heading", { name: /영역Ⅰ/ }).isVisible(), "미응답이면 못 넘어가고 표시됨");
  t(await pg.evaluate(() => document.activeElement && document.activeElement.name === "a1pre"), "첫 미응답 문항으로 이동(포커스)");
  if (vp.width < 500) await pg.screenshot({ path: ROOT + "tests/shots/student-missing-phone.png" });
  // 영역Ⅰ 답하기 (일부 → 새로고침 → 자동저장 확인)
  for (let n = 1; n <= 8; n++) { await pg.locator(`label[for="a${n}pre-2"]`).click(); if (n <= 4) await pg.locator(`label[for="a${n}now-4"]`).click(); }
  await pg.reload(); await sleep(300);
  t(await pg.getByRole("heading", { name: /영역Ⅰ/ }).isVisible() && await pg.locator("#a3now-4").isChecked() && await pg.locator("#a7pre-2").isChecked(), "새로고침해도 이어서(자동 저장)");
  for (let n = 5; n <= 8; n++) await pg.locator(`label[for="a${n}now-5"]`).click();
  await pg.getByRole("button", { name: "다음" }).click(); await sleep(150);
  const seen = [];
  for (let guard = 0; guard < 10; guard++) {
    const h = await pg.locator("h2").first().textContent();
    if (h.includes("서술형")) break;
    seen.push(h);
    const qs = await pg.locator("fieldset.q").evaluateAll(fs => fs.map(f => f.id.slice(2)));
    for (const n of qs) await pg.locator(`label[for="a${n}-${(Number(n) % 5) + 1}"]`).click();
    await pg.getByRole("button", { name: "다음" }).click(); await sleep(150);
  }
  console.log("   본 영역:", seen.join(" | "));
  const hasIII = seen.some(h => h.includes("영역Ⅳ"));
  t(actAi ? hasIII : !hasIII, actAi ? "AI 문제 풀기 체크 → 영역Ⅳ 보임" : "AI 문제 풀기 미체크 → 영역Ⅳ 숨김");
  t(!(await pg.getByText("역채점").count()) && !(await pg.getByText("역문항").count()), "학생 화면에 역문항 표시 없음");
  await pg.getByLabel("① 처음에 쓴 것").fill("힘이 세져서 빨라진다");
  await pg.getByLabel("② 받은 질문").fill("그 힘은 어떤 에너지야?");
  await pg.getByLabel("③ 수정한 것").fill("위치에너지가 운동에너지로 바뀌어서 빨라진다");
  const ov = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); t(!ov, "가로 스크롤 없음");
  failNext = 2; // 첫 제출은 네트워크 실패 → 안내 후 다시 제출
  await pg.getByRole("button", { name: "제출하기" }).click(); await sleep(1800);
  t(await pg.getByRole("alert").filter({ hasText: "보내지 못했어요" }).isVisible() && posted.length === 0, "제출 실패 시 안내, 내용 유지");
  await pg.getByRole("button", { name: "제출하기" }).click(); await sleep(500);
  t(posted.length === 1, "제출 1건 저장");
  const p = posted[0];
  t(p.grade === 3 && p.cls === 2 && p.num === 14 && p.act_curi === true && p.act_ai === actAi, "학년·반·번호·활동 저장");
  t(p.answers["1"].pre === 2 && p.answers["1"].now === 4 && p.answers["8"].now === 5, "영역Ⅰ 수업 전/지금 값 정확");
  t(actAi ? p.answers["18"] !== null && p.answers["26"] !== null && p.answers["13"] !== null : p.answers["18"] === null && p.answers["20"] === null && p.answers["26"] === null && p.answers["13"] !== null, "해당 없음 문항은 null");
  t(Object.keys(p.answers).length === 35 && p.essay.revised.includes("운동에너지") && p.essay.prompt === CFG.question, "35문항 + 서술형(당시 질문 포함) 저장");
  t(!JSON.stringify(p).toLowerCase().includes("snorkl"), "데이터에 Snorkl 단어 없음");
  t(await pg.getByText("제출했어요").isVisible(), "완료 화면");
  await pg.getByRole("button", { name: "제출했어요" }).count();
  await pg.reload(); await sleep(300);
  t(await pg.getByText("제출했어요").isVisible(), "새로고침해도 완료 화면(중복 제출 방지)");
  await pg.getByRole("button", { name: "다시 내기" }).click(); await sleep(200);
  t(await pg.getByRole("button", { name: "시작하기" }).isVisible(), "'다시 내기'로 새로 제출 가능");
  if (vp.width < 500) await pg.screenshot({ path: ROOT + "tests/shots/student-start-phone.png", fullPage: true });
  await ctx.close();
}
await student({ width: 390, height: 844 }, false);
await student({ width: 1280, height: 800 }, true);

// ── 교사 화면 ──
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.route(/jsdelivr/, block);
  const saved = [];
  await ctx.route(/rpc\/post_survey_rows/, async r => { const { pw } = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pw === "21442144" ? FAKE : { error: "bad" }) }); });
  await ctx.route(/rpc\/post_survey_save_codes/, async r => { const body = JSON.parse(r.request().postData()); saved.push(...body.items); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: body.items.length }) }); });
  await cfgRoute(ctx);
  let cfgSaved = null;
  await ctx.route(/rpc\/post_survey_set_config/, async r => { cfgSaved = JSON.parse(r.request().postData()).essay; CFG = cfgSaved; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); });
  let delCall = null;
  await ctx.route(/rpc\/post_survey_set_deleted/, async r => { delCall = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ updated: delCall.ids.length }) }); });
  await ctx.route(/\/api\/classify/, async r => { const { items } = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: items.map(i => ({ id: i.id, codes: ["원리·이유", "용어·단위"] })) }) }); });
  const pg = await ctx.newPage(); pg.on("pageerror", e => t(false, "pageerror " + e.message));
  await pg.goto("http://localhost:4300/teacher"); await sleep(300);
  await pg.getByLabel("비밀번호").fill("1111"); await pg.getByRole("button", { name: "들어가기" }).click(); await sleep(300);
  t(await pg.getByRole("alert").filter({ hasText: "맞지 않아요" }).isVisible(), "교사: 틀린 비밀번호 안내");
  await pg.getByLabel("비밀번호").fill("21442144"); await pg.getByRole("button", { name: "들어가기" }).click(); await sleep(500);
  t(await pg.getByRole("heading", { name: "📊 사후 설문 분석" }).isVisible(), "교사: 분석 화면 열림");
  const kpi = await pg.locator(".kpi").first().textContent();
  t(kpi.includes(String(EXP.N)), `응답 학생 수 ${EXP.N} (중복 제출은 최신만)`);
  const totalRow = await pg.locator("#prepost tr.sum td").allTextContents();
  t(Number(totalRow[2]) === EXP.N && near(totalRow[6], EXP.I_t) && Number(totalRow[7]) === EXP.I_df && near(totalRow[9], EXP.I_dz), `영역Ⅰ 대응 t = ${totalRow[6]} (scipy ${EXP.I_t.toFixed(3)}), dz = ${totalRow[9]}`);
  const r1 = await pg.locator("#prepost tbody tr").first().locator("td").allTextContents();
  t(near(r1[6], EXP.item1_t), `1번 문항 t = ${r1[6]} (scipy ${EXP.item1_t.toFixed(3)})`);
  const i12 = await pg.locator("#domains tr", { hasText: "포기하고 싶었다" }).locator("td").allTextContents();
  t(near(i12[3], EXP.item12_mean) && i12[1].includes("역채점"), `17번 역채점 평균 ${i12[3]} (기대 ${EXP.item12_mean.toFixed(3)})`);
  const a2 = await pg.locator("#domains tr", { hasText: "Ⅲ 오류 분석" }).first().locator("td").allTextContents();
  t(near(a2[4], EXP.alpha_II, 0.0011), `영역Ⅲ α = ${a2[4]} (scipy식 ${EXP.alpha_II.toFixed(4)})`);
  const sp = await pg.locator("#curi tbody tr", { hasText: "1차→최종" }).locator("td").allTextContents();
  t(Number(sp[2]) === EXP.sp_n && near(sp[3], EXP.sp_rho, 0.0011), `큐리 연결 스피어만 n=${sp[2]}, ρ=${sp[3]} (scipy ${EXP.sp_rho.toFixed(4)})`);
  // 사전 CSV (학번 있음 → 대응)
  await pg.locator("#pre input[type=file]").setInputFiles(ROOT + "tests/pre_with_id.csv"); await sleep(400);
  t(await pg.getByText("대응표본 t검정을 썼어요").isVisible(), "사전 CSV(학번 있음) → 대응표본");
  const pr = await pg.locator("#pre tr.sum td").allTextContents();
  t(near(pr[7], EXP.pre_paired_t) && Number(pr[3]) === EXP.pre_n, `영역Ⅶ 사전 대응 t = ${pr[7]} (scipy ${EXP.pre_paired_t.toFixed(3)})`);
  await pg.locator("#pre input[type=file]").setInputFiles(ROOT + "tests/pre_no_id.csv"); await sleep(400);
  t(await pg.getByText("Welch t검정으로 비교했어요").isVisible(), "사전 CSV(학번 없음) → Welch");
  const pw2 = await pg.locator("#pre tr.sum td").allTextContents();
  t(near(pw2[7], EXP.pre_welch_t), `영역Ⅶ Welch t = ${pw2[7]} (scipy ${EXP.pre_welch_t.toFixed(3)})`);
  // 서술형 AI 분류 → 저장 → 교사 수정
  const before = saved.length;
  await pg.getByRole("button", { name: /AI로 분류하기/ }).click(); await sleep(1200);
  t(saved.length > before && saved.every(s => s.source === "ai" || s.source === "teacher"), `AI 분류 결과 저장 (${saved.length - before}개)`);
  const card = pg.locator(".essay-card").first();
  await card.getByLabel("기타").check(); await sleep(100);
  await pg.getByRole("button", { name: /수정한 분류 저장/ }).click(); await sleep(500);
  t(saved.some(s => s.source === "teacher" && s.codes.includes("기타")), "교사가 고친 분류 저장");
  // 응답 삭제
  pg.once("dialog", d => d.accept());
  await pg.locator("#manage input[type=checkbox]").first().check();
  await pg.getByRole("button", { name: /선택한 응답 1건 삭제/ }).click(); await sleep(600);
  t(delCall && delCall.deleted === true && delCall.ids.length === 1 && delCall.ids[0] === Math.max(...FAKE.rows.map(r => r.id)), "응답 관리: 선택한 응답 삭제 요청(최신 응답)");
  // 서술형 문항 수정 → 학생 화면 반영
  await pg.getByText("학생에게 보이는 서술형 문항 수정하기").click();
  await pg.getByLabel("서술형 질문").fill("AI의 질문으로 생각이 바뀐 순간을 적어 주세요.");
  await pg.getByLabel("답 칸 3 제목").fill("");
  await pg.getByRole("button", { name: "서술형 문항 저장" }).click(); await sleep(300);
  t(cfgSaved && cfgSaved.question.includes("생각이 바뀐 순간") && cfgSaved.labels[2] === "", "교사: 서술형 문항 수정 저장");
  { const sp = await ctx.newPage(); await sp.goto("http://localhost:4300/"); await sp.evaluate(() => localStorage.setItem("post-survey-draft-v2", JSON.stringify({ step: 7, grade: "3", cls: "1", num: "1", actAi: false, actCuri: true, ans: {}, essay: { first: "", question: "", revised: "" } }))); await sp.reload(); await sleep(500);
    t(await sp.getByText("생각이 바뀐 순간").isVisible() && (await sp.locator("textarea").count()) === 2, "학생 화면에 수정한 질문 반영, 빈 칸은 숨김"); await sp.close(); }
  // 보고서 문장·표 복사·엑셀
  const sent = await pg.locator(".sentence").first().textContent();
  t(sent.includes(`t(${EXP.I_df})=`) && sent.includes("유의하였다"), "보고서 문장: 계산값으로 채움");
  await pg.locator("#prepost .tbtn", { hasText: "표 복사" }).click(); await sleep(200);
  const clip = await pg.evaluate(() => navigator.clipboard.readText());
  t(clip.split("\n")[0].split("\t").length === 10 && clip.includes("전체\t영역 평균"), "표 복사(탭 구분)");
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.locator(".thead").getByRole("button", { name: /엑셀로 내려받기/ }).click()]);
  const xp = ROOT + "tests/shots/out.xlsx"; await dl.saveAs(xp);
  const chk = execSync(`python3 -c "import openpyxl,sys; wb=openpyxl.load_workbook('${xp}'); print(wb.sheetnames, wb['원자료'].max_row, wb['원자료'].max_column, wb['학생별 점수']['G2'].value, wb['학생별 점수'].max_row)"`).toString();
  t(chk.includes("학생별 점수") && chk.includes("서술형 분류") && chk.includes(" 121 "), "엑셀 5개 시트, 원자료 120명+머리글: " + chk.trim());
  t(!(await pg.content()).toLowerCase().includes("snorkl"), "교사 화면에 Snorkl 단어 없음");
  await pg.screenshot({ path: ROOT + "tests/shots/teacher-wide.png", fullPage: true });
  await pg.setViewportSize({ width: 390, height: 844 }); await sleep(200);
  const ov = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); t(!ov, "교사 화면 휴대폰 폭 가로 스크롤 없음(표는 상자 안에서만)");
  await ctx.close();
}
await b.close(); srv.close();
console.log(`\n${ok} 통과 / ${bad} 실패`); process.exit(bad ? 1 : 0);
