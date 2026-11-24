/**
 * Punjai Capitals – Join form → Google Sheet
 * -------------------------------------------
 * The website (js/main.js) sends every form field as JSON. This script writes one row per registration.
 * A field that is new on the website gets its own new column automatically — nothing to edit here.
 *
 * SETUP (once, logged in as the club Google account) — no Google Form needed
 *   1. script.google.com → New project (or open the existing one). Paste this whole file, click Save.
 *   2. In the menu next to "Debug" pick  testSetup  and click Run. Allow the permissions.
 *      It creates the Google Sheet "Punjai Capitals – Members" in your Drive and prints its link in the Execution log.
 *   3. Deploy → New deployment → ⚙ "Web app".
 *        Execute as: Me      Who has access: Anyone
 *      Click Deploy, then Authorize access → choose the club account → Allow.
 *   4. Copy the "Web app URL" (ends in /exec) and paste it into SCRIPT_URL at the top of js/main.js.
 *
 * AFTER EDITING THIS SCRIPT: Deploy → Manage deployments → ✏ Edit → Version: "New version" → Deploy.
 * (The URL stays the same. Without a new version the website keeps using the old code.)
 */

var SHEET_ID = '';                                   // leave '' — testSetup creates the sheet and remembers it.
                                                     // Only to use a sheet you already have: its id from docs.google.com/spreadsheets/d/THIS_PART/edit
var SHEET_TITLE = 'Punjai Capitals – Members';       // name of the sheet testSetup creates
var SHEET_NAME = 'Members';                          // tab name; created automatically if missing
var NOTIFY_EMAIL = 'punjaicapitalsclub@gmail.com';   // gets an email for every new member; '' to switch off
var SITE_URL = 'https://nkarthikeyan2k1.github.io/punjaicapitals/';
var MAX_FIELDS = 60, MAX_LEN = 1000;                 // ignore anything bigger than a real registration
var MAX_BODY = 20000;                                // bytes; a real registration is ~1 KB
var REQUIRED = ['Full name', 'Mobile'];              // checked here too, because anyone can post to a public URL directly
var MAX_PER_HOUR = 60;                               // flood guard for the whole form
var MIN_SECONDS = 4;                                 // people need longer than this to fill two steps; bots don't

/*
 * Safety: the web app URL is public (it is in the website's JavaScript). It can only ADD rows —
 * it never reads or returns sheet data. Everything below checks what arrives before writing it.
 */
function doPost(e) {
  var body = (e && e.postData && e.postData.contents) || '';
  if (body.length > MAX_BODY) return reply_({ ok: false, error: 'too_large' });
  var data;
  try { data = JSON.parse(body); } catch (err) { return reply_({ ok: false, error: 'bad_json' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply_({ ok: false, error: 'bad_json' });

  // Spam bots: they fill the hidden "_hp" field or submit instantly. Answer "ok" so they don't retry, but save nothing.
  if (data._hp || (data._t !== undefined && +data._t < MIN_SECONDS)) return reply_({ ok: true });

  var keys = Object.keys(data).filter(function (k) {               // field names become column headers: no internal, long or formula-like names
    return k.charAt(0) !== '_' && k.length <= 80 && !/^[=+\-@]/.test(k);
  }).slice(0, MAX_FIELDS);
  for (var i = 0; i < REQUIRED.length; i++) if (!clean_(data[REQUIRED[i]])) return reply_({ ok: false, error: 'missing ' + REQUIRED[i] });
  for (i = 0; i < keys.length; i++) {                                   // every "… mobile" field must be a 10-digit Indian mobile
    if (/mobile/i.test(keys[i]) && clean_(data[keys[i]]) && !/^[6-9]\d{9}$/.test(clean_(data[keys[i]]))) return reply_({ ok: false, error: 'bad ' + keys[i] });
  }

  var cache = CacheService.getScriptCache();
  var hour = 'n' + Math.floor(Date.now() / 3600000), count = +(cache.get(hour) || 0);
  if (count >= MAX_PER_HOUR) return reply_({ ok: false, error: 'busy' });
  var dupKey = 'm' + clean_(data['Mobile']);
  if (cache.get(dupKey)) return reply_({ ok: true, duplicate: true });  // same mobile again within 10 min (double click / resend): keep one row

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);                              // two people submitting at once must not overwrite each other
  try {

    var ss = spreadsheet_();
    if (!ss) throw new Error('No sheet yet: run testSetup once in the Apps Script editor.');
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // header row: keep existing columns, add any new field names at the end
    var headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (headers[0] !== 'Submitted at') headers.unshift('Submitted at');
    keys.forEach(function (k) { if (headers.indexOf(k) === -1) headers.push(k); });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);

    var row = headers.map(function (h) {
      if (h === 'Submitted at') return new Date();
      return Object.prototype.hasOwnProperty.call(data, h) ? clean_(data[h]) : '';
    });
    var r = sheet.getLastRow() + 1;
    sheet.getRange(r, 1).setNumberFormat('dd MMM yyyy, hh:mm');                       // timestamp column
    sheet.getRange(r, 2, 1, row.length - 1).setNumberFormat('@');                     // the rest as plain text: keeps mobile numbers as typed
    sheet.getRange(r, 1, 1, row.length).setValues([row]);

    cache.put(hour, String(count + 1), 3600);
    cache.put(dupKey, '1', 600);

    if (NOTIFY_EMAIL) {
      var name = clean_(data['Full name']).replace(/\s+/g, ' ').slice(0, 80) || 'New member';
      var lines = keys.map(function (k) { return k + ': ' + clean_(data[k]); }).join('\n');
      MailApp.sendEmail(NOTIFY_EMAIL, 'New member: ' + name,
        lines + '\n\nAll registrations: ' + ss.getUrl() + '\nWebsite: ' + SITE_URL);
    }
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);                                // details go to Apps Script → Executions, never to the public
    return reply_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// The sheet to write to: SHEET_ID if set, else the one testSetup created and remembered.
// (Deliberately never "the file this script is attached to": if the project was opened from a Google Form,
//  Google would try to open the form as a spreadsheet and fail with "Document … is missing".)
function spreadsheet_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var saved = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return saved ? SpreadsheetApp.openById(saved) : null;
}

// RUN THIS ONCE FROM THE EDITOR after pasting or changing the script: pick "testSetup" in the menu next to Debug, click Run.
// It asks for every permission the web app needs, creates the sheet if there is none yet, and prints its link.
function testSetup() {
  var ss;
  try { ss = spreadsheet_(); }
  catch (err) { throw new Error('SHEET_ID is not a Google Sheet id. Set it back to \'\' (empty) and run testSetup again. ' + err); }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_TITLE);
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
    Logger.log('Created a new sheet: ' + ss.getUrl());
  }
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  CacheService.getScriptCache().put('setup', '1', 60);
  Logger.log('OK — registrations go to "' + ss.getName() + '", tab "' + sheet.getName() + '": ' + ss.getUrl());
  Logger.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
}

// Opening the web app URL in a browser shows this — a quick way to check the deployment works.
function doGet() {
  return reply_({ ok: true, message: 'Punjai Capitals join form is connected.' });
}

// Text only, trimmed, and never starting with = + - @ so a value can't run as a spreadsheet formula.
function clean_(v) {
  var s = String(v == null ? '' : v).slice(0, MAX_LEN).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
