/**
 * Wild Robot comprehension – results backend (Google Apps Script).
 *
 * Paste this whole file into Extensions > Apps Script in a new Google Sheet.
 * Full instructions are in SETUP.md.
 *
 * Students' quiz pages POST each finished quiz here, and one row is added to the "Results" sheet.
 * The teacher results page reads the rows back (GET) and saves written-answer marks (POST),
 * but only when it sends the teacher key stored in Project Settings > Script properties > TEACHER_KEY.
 */

var SHEET_NAME = "Results";
var HEADERS = [
  "ID", "Submitted", "Chapter", "Chapter title", "Student",
  "Computer score", "Computer max", "Written marks", "Written max",
  "Total", "Total max", "Details (JSON)"
];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.hideColumns(COL["ID"]);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function teacherOk_(key) {
  var real = PropertiesService.getScriptProperties().getProperty("TEACHER_KEY");
  return !!real && key === real;
}

function findRow_(sh, id) {
  if (!id) return 0;
  var hit = sh.getRange(2, COL["ID"], Math.max(sh.getLastRow() - 1, 1), 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function clean_(s, max) { return String(s == null ? "" : s).slice(0, max || 200); }

/* ---------- POST: a student result, or a teacher saving written marks ---------- */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad_json" }); }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();

    if (body.action === "mark") {
      if (!teacherOk_(body.key)) return json_({ ok: false, error: "wrong_key" });
      var row = findRow_(sh, body.id);
      if (!row) return json_({ ok: false, error: "not_found" });
      var marks = (body.marks || []).map(function (m) { return m === null || m === "" ? null : Number(m); });
      var details = JSON.parse(sh.getRange(row, COL["Details (JSON)"]).getValue() || "{}");
      details.writtenMarks = marks;
      var done = marks.length && marks.every(function (m) { return m !== null && !isNaN(m); });
      var written = done ? marks.reduce(function (a, b) { return a + b; }, 0) : "";
      var comp = Number(sh.getRange(row, COL["Computer score"]).getValue()) || 0;
      sh.getRange(row, COL["Written marks"]).setValue(written);
      sh.getRange(row, COL["Total"]).setValue(done ? comp + written : "");
      sh.getRange(row, COL["Details (JSON)"]).setValue(JSON.stringify(details));
      return json_({ ok: true });
    }

    // Student result
    if (findRow_(sh, body.id)) return json_({ ok: true, duplicate: true }); // a retry of a result already saved
    var r = body.result || {};
    var detailsJson = JSON.stringify({ skills: r.skills || {}, questions: r.questions || [], writtenMarks: [] });
    if (detailsJson.length > 45000) return json_({ ok: false, error: "too_large" });
    sh.appendRow([
      clean_(body.id, 60),
      new Date(),
      Number(r.chapter) || "",
      clean_(r.chapterTitle, 80),
      clean_(r.student, 40),
      Number(r.autoScore) || 0,
      Number(r.autoMax) || 0,
      "",
      Number(r.writtenMax) || 0,
      "",
      (Number(r.autoMax) || 0) + (Number(r.writtenMax) || 0),
      detailsJson
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- GET: the teacher results page reads every row ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== "results") return json_({ ok: true, service: "Wild Robot results" });
  if (!teacherOk_(p.key)) return json_({ ok: false, error: "wrong_key" });
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return json_({ ok: true, rows: [] });
  var values = sh.getRange(2, 1, n, HEADERS.length).getValues();
  var rows = values.map(function (v) {
    var details = {};
    try { details = JSON.parse(v[COL["Details (JSON)"] - 1] || "{}"); } catch (err) {}
    return {
      id: v[0],
      submitted: v[1] instanceof Date ? v[1].toISOString() : String(v[1]),
      chapter: v[2], chapterTitle: v[3], student: v[4],
      autoScore: v[5], autoMax: v[6], writtenMax: v[8],
      skills: details.skills || {}, questions: details.questions || [], writtenMarks: details.writtenMarks || []
    };
  });
  return json_({ ok: true, rows: rows });
}
