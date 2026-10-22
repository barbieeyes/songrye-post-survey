// 사후 설문 응답을 이 스프레드시트의 '응답' 시트에 한 줄씩 추가합니다.
// 붙여 넣는 곳: 스프레드시트 › 확장 프로그램 › Apps Script
// 배포: 배포 › 새 배포 › 유형 '웹 앱' › 실행 사용자 '나' · 액세스 권한 '모든 사용자' › 배포 → 나온 웹 앱 URL을 앱에 넣습니다.

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var a = d.answers || {};
    var row = [
      Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"),
      num_(d.grade), num_(d.cls), num_(d.num),
      d.act_ai ? "예" : "아니오", d.act_curi ? "예" : "아니오"
    ];
    for (var n = 1; n <= 8; n++) {
      var v = a[n] || a[String(n)] || {};
      row.push(score_(v.pre), score_(v.now));
    }
    for (var m = 9; m <= 30; m++) {
      var x = a[m] !== undefined ? a[m] : a[String(m)];
      row.push(x === null || x === undefined ? "해당 없음" : score_(x));
    }
    var es = d.essay || {};
    row.push(text_(es.first), text_(es.question), text_(es.revised), text_(d.app_version));
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("응답");
    sh.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function num_(v) { var n = Number(v); return isFinite(n) ? n : ""; }
function score_(v) { var n = Number(v); return n >= 1 && n <= 5 ? n : ""; }
// 수식으로 해석되지 않게 앞에 작은따옴표를 붙임
function text_(s) { s = String(s || "").slice(0, 1500); return /^[=+\-@]/.test(s) ? "'" + s : s; }
