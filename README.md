# 송례중 사후 설문 앱

AI 기반 오류 분석 학습 연구의 **사후 설문**을 받고 바로 분석하는 앱이에요. 큐리 앱과는 별도로 움직여요.

- 학생용: `/` (학년·반·번호 → 영역Ⅰ~Ⅵ → 서술형 → 제출)
- 교사용: `/teacher` (큐리 교사용과 같은 비밀번호)

## 구조 (빌드 없음)
| 파일 | 하는 일 |
|---|---|
| `index.html`, `assets/survey.js` | 학생용 설문 화면 |
| `teacher.html`, `assets/teacher.js` | 교사용 분석 화면 |
| `assets/items.js` | 문항 문구(설문지와 동일), Supabase 주소 |
| `assets/analysis.js`, `assets/stats.js` | 역채점, 기술통계, α, 대응/Welch t, 스피어만 |
| `assets/xlsx.js` | 엑셀 파일 만들기(외부 라이브러리 없음) |
| `api/classify.js` | 서술형 AI 분류(Vercel 함수, `ANTHROPIC_API_KEY` 필요) |

## 데이터 (Supabase 프로젝트 hcvaaxxwqqrbpnloyjzr)
- `post_survey`: 학생은 추가만 가능(RLS), 읽기 불가
- `post_survey_coding`: 서술형 분류
- `post_survey_rows(pw)`, `post_survey_save_codes(pw, items)`: 교사 비밀번호로만 동작(큐리와 같은 bcrypt 해시·잠금 규칙)
- 큐리 표(`curi_submissions`)는 **읽기만** 하며, 학년·반·번호와 수정 기록 숫자만 가져와요(이름 제외).

## 배포 (Vercel)
1. 이 폴더를 GitHub 저장소에 올려요.
2. Vercel → Add New → Project → 그 저장소 Import. Framework는 **Other**, Build Command는 비워 둬요.
3. Settings → Environment Variables에 `ANTHROPIC_API_KEY`를 넣어요(서술형 AI 분류용. 없어도 나머지는 동작).

## 테스트
```
node tests/make_fake.mjs && python3 tests/expected.py
node tests/stats_dump.mjs | python3 tests/check_stats.py   # 통계 함수 ↔ scipy 320개 대조
node tests/e2e.mjs                                         # 학생·교사 화면 59개 검사 (Playwright)
```
