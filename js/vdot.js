/* =====================================================================
   VDOT running calculator (vdotcalculator/index.html)
   Jack Daniels & Jimmy Gilbert's formulas:
     VO2 cost of running at v m/min     = -4.60 + 0.182258·v + 0.000104·v²
     share of VO2max you can hold t min = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)
     VDOT = VO2 cost / share
   Training paces = the speed whose VO2 cost is a set % of VDOT (calibrated against vdoto2.com).
   Everything recalculates on every slider movement — no "Calculate" button.
   ===================================================================== */
(function(){
'use strict';
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ---------- maths ---------- */
var MI = 1.609344;
function vo2(v){ return -4.60 + 0.182258 * v + 0.000104 * v * v; }
function share(t){ return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t); }
function vdotOf(km, sec){ var t = sec / 60; return vo2(km * 1000 / t) / share(t); }
function raceSec(km, V){                                   // finish time (s) for a distance at a given VDOT
  var lo = km * 1.2, hi = km * 25;                          // minutes
  for (var i = 0; i < 60; i++){ var m = (lo + hi) / 2; if (vdotOf(km, m * 60) > V) lo = m; else hi = m; }
  return (lo + hi) / 2 * 60;
}
function speedAt(o){ return (-0.182258 + Math.sqrt(0.182258 * 0.182258 + 4 * 0.000104 * (4.60 + o))) / (2 * 0.000104); }   // m/min
function paceAt(pct, V){ return 60000 / speedAt(pct * V); }                                                               // s per km

var RACES = [
  { k: '1500m', km: 1.5, n: '1500 m' }, { k: 'Mile', km: MI, n: '1 mile' }, { k: '3K', km: 3, n: '3K' }, { k: '5K', km: 5, n: '5K' },
  { k: '10K', km: 10, n: '10K' }, { k: '15K', km: 15, n: '15K' }, { k: 'Half', km: 21.0975, n: 'Half marathon' }, { k: 'Marathon', km: 42.195, n: 'Marathon' }
];
var ZONES = [
  { k: 'E', n: 'Easy', c: '#2E9D6B', lo: .62, hi: .70, d: 'Most of your week: easy days, long runs, recovery. You can talk in full sentences.' },
  { k: 'M', n: 'Marathon', c: '#2F7DD1', m: true, d: 'Goal marathon pace. Steady blocks inside long runs.' },
  { k: 'T', n: 'Threshold', c: '#D9941A', pct: .88, d: 'Comfortably hard. 20-minute tempo or 1 km repeats.' },
  { k: 'I', n: 'Interval', c: '#D4440F', pct: .975, d: 'Hard. 3–5 minute reps with equal jog recovery.' },
  { k: 'R', n: 'Repetition', c: '#B42318', pct: 1.05, d: 'Fast and relaxed. 200–400 m reps, full recovery.' }
];
function level(V){ return V < 30 ? 'Starting out' : V < 38 ? 'Building the base' : V < 46 ? 'Club runner' : V < 54 ? 'Strong club runner' : V < 62 ? 'Competitive' : V < 70 ? 'Sub-elite' : 'Elite'; }

/* ---------- formatting / parsing ---------- */
function two(n){ return String(n).padStart(2, '0'); }
function fmtTime(s){ s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? h + ':' + two(m) + ':' + two(x) : m + ':' + two(x); }
function fmtPace(sPerKm){ return fmtTime(S.unit === 'mi' ? sPerKm * MI : sPerKm); }
function unitLabel(){ return S.unit === 'mi' ? '/mi' : '/km'; }
function parseTime(str){                                    // "45:00", "1:39:49", "4500", "1.39.49" → seconds
  str = String(str).trim(); if (!str) return NaN;
  var p = str.split(/[:.\s]+/).filter(Boolean).map(Number);
  if (p.some(isNaN)) return NaN;
  if (p.length === 1){ var d = String(p[0]); if (d.length <= 2) return p[0] * 60; p = [+(d.slice(0, -4) || 0), +d.slice(-4, -2), +d.slice(-2)]; }
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return NaN;
}
function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

/* ---------- state ---------- */
var PACE_MIN = 150, PACE_MAX = 720;                         // 2:30 – 12:00 per km
var S = { tab: 'vdot', unit: 'km', km: 10, sec: 2700, pace: 300 };

var el = {
  dist: $('#dist'), distIn: $('#distIn'), distUnit: $('#distUnit'), distName: $('#distName'),
  time: $('#time'), timeIn: $('#timeIn'), timeNote: $('#timeNote'),
  pace: $('#pace'), paceIn: $('#paceIn'), paceUnit: $('#paceUnit'), paceNote: $('#paceNote'),
  ring: $('#ringFg'), ringK: $('#ringK'), ringV: $('#ringV'), ringS: $('#ringS'), legOn: $('#legOn'), legOff: $('#legOff'),
  sum: $('#sum'), zones: $('#zones'), splits: $('#splits'), equiv: $('#equiv'), paceTbl: $('#paceTbl'), chips: $('#chips')
};

/* ---------- distance presets ---------- */
el.chips.innerHTML = RACES.map(function(r, i){ return '<button type="button" data-i="' + i + '" aria-pressed="false">' + r.k + '</button>'; }).join('');
function raceFor(km){ for (var i = 0; i < RACES.length; i++) if (Math.abs(RACES[i].km - km) < 0.006) return RACES[i]; return null; }

/* ---------- render ---------- */
function fill(r){ var p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', clamp(p, 0, 100) + '%'); }
function setRange(r, v){ r.value = v; fill(r); }
function setPill(input, text){ if (document.activeElement !== input){ input.value = text; input.removeAttribute('aria-invalid'); } }

function render(){
  var km = S.km, race = raceFor(km), dispDist = S.unit === 'mi' ? km / MI : km;
  // distance row
  setRange(el.dist, km);
  setPill(el.distIn, (Math.round(dispDist * 100) / 100).toString());
  el.distUnit.textContent = S.unit;
  el.distName.textContent = race ? race.n : (S.unit === 'mi' ? (Math.round(km * 100) / 100) + ' km' : (Math.round(km / MI * 100) / 100) + ' mi');
  el.dist.setAttribute('aria-valuetext', race ? race.n : (Math.round(dispDist * 10) / 10) + ' ' + S.unit);
  $$('button', el.chips).forEach(function(b){ b.setAttribute('aria-pressed', String(race === RACES[+b.getAttribute('data-i')])); });

  if (S.tab === 'vdot') renderVdot(km); else renderPace(km);
  // slim live bar (phones): mirrors the ring
  $('#liveK').textContent = el.ringK.textContent; $('#liveV').textContent = el.ringV.textContent; $('#liveS').textContent = el.ringS.textContent;
  saveUrl();
}

function renderVdot(km){
  var lo = Math.round(km * PACE_MIN), hi = Math.round(km * PACE_MAX);
  el.time.min = lo; el.time.max = hi; S.sec = clamp(S.sec, lo, hi);
  setRange(el.time, S.sec);
  setPill(el.timeIn, fmtTime(S.sec));
  var pace = S.sec / km;
  el.timeNote.textContent = 'Pace ' + fmtPace(pace) + ' ' + unitLabel();
  el.time.setAttribute('aria-valuetext', fmtTime(S.sec));

  var V = vdotOf(km, S.sec), Vr = Math.round(V * 10) / 10;
  el.ringK.textContent = 'VDOT'; el.ringV.textContent = Vr.toFixed(1); el.ringV.classList.remove('is-long'); el.ringS.textContent = level(V);
  el.legOn.textContent = 'Your VDOT'; el.legOff.textContent = 'Scale 30–85';
  el.ring.style.strokeDasharray = clamp((V - 30) / 55 * 100, 2, 100).toFixed(1) + ' 100';
  $$('.js-vdot').forEach(function(x){ x.textContent = Vr.toFixed(1); });

  // summary: race pace + two predictions for other (longer where possible) distances
  var others = [RACES[4], RACES[6], RACES[7], RACES[3]].filter(function(r){ return Math.abs(r.km - km) > 0.006; }).slice(0, 2);
  el.sum.innerHTML = '<div><dt>Race pace</dt><dd>' + fmtPace(pace) + '<small>' + unitLabel() + '</small></dd></div>' +
    others.map(function(r){ return '<div><dt>Predicted ' + r.n.toLowerCase().replace('half marathon', 'half') + '</dt><dd>' + fmtTime(raceSec(r.km, V)) + '</dd></div>'; }).join('');

  // training zones
  var mPace = raceSec(42.195, V) / 42.195;
  el.zones.innerHTML = ZONES.map(function(z){
    var val = z.lo ? fmtPace(paceAt(z.hi, V)) + '–' + fmtPace(paceAt(z.lo, V)) : fmtPace(z.m ? mPace : paceAt(z.pct, V));
    return '<article class="zone" style="--z:' + z.c + '"><span class="zone__k"><i>' + z.k + '</i>' + z.n + '</span><b>' + val + '<small>' + unitLabel() + '</small></b><p>' + z.d + '</p></article>';
  }).join('');

  // workout splits
  var T = paceAt(.88, V), I = paceAt(.975, V), R = paceAt(1.05, V), long = S.unit === 'mi' ? ['1 mile', MI] : ['1 km', 1];
  var cols = [['200 m', .2], ['400 m', .4], ['800 m', .8], long];
  var rows = [['Threshold', T], ['Interval', I], ['Repetition', R], ['Fast reps', R - 20]];
  el.splits.innerHTML = el.splits.querySelector('caption').outerHTML +
    '<thead><tr><th scope="col">Pace</th>' + cols.map(function(c){ return '<th scope="col">' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r){ return '<tr><th scope="row">' + r[0] + '</th>' + cols.map(function(c){ return '<td>' + fmtTime(r[1] * c[1]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';

  // equivalent races
  el.equiv.innerHTML = el.equiv.querySelector('caption').outerHTML +
    '<thead><tr><th scope="col">Race</th><th scope="col">Time</th><th scope="col">Pace ' + unitLabel() + '</th></tr></thead><tbody>' +
    RACES.slice().reverse().map(function(r){ var s = raceSec(r.km, V); var you = Math.abs(r.km - km) < 0.006;
      return '<tr' + (you ? ' class="is-you"' : '') + '><th scope="row">' + r.n + '</th><td>' + fmtTime(you ? S.sec : s) + '</td><td>' + fmtPace((you ? S.sec : s) / r.km) + '</td></tr>'; }).join('') + '</tbody>';
}

function renderPace(km){
  var lo = PACE_MIN, hi = PACE_MAX;
  el.pace.min = lo; el.pace.max = hi; S.pace = clamp(S.pace, lo, hi);
  setRange(el.pace, S.pace);
  setPill(el.paceIn, fmtPace(S.pace)); el.paceUnit.textContent = unitLabel();
  var kmh = 3600 / S.pace;
  el.paceNote.textContent = (S.unit === 'mi' ? (kmh / MI).toFixed(1) + ' mph' : kmh.toFixed(1) + ' km/h');
  el.pace.setAttribute('aria-valuetext', fmtPace(S.pace) + ' ' + unitLabel());

  var total = S.pace * km;
  el.ringK.textContent = 'FINISH'; el.ringV.textContent = fmtTime(total); el.ringV.classList.toggle('is-long', fmtTime(total).length > 5); el.ringS.textContent = fmtPace(S.pace) + ' ' + unitLabel();
  el.legOn.textContent = 'Faster'; el.legOff.textContent = 'Slower';
  el.ring.style.strokeDasharray = clamp((PACE_MAX - S.pace) / (PACE_MAX - PACE_MIN) * 100, 2, 100).toFixed(1) + ' 100';
  $$('.js-pace').forEach(function(x){ x.textContent = fmtPace(S.pace) + ' ' + unitLabel(); });

  el.sum.innerHTML = '<div><dt>Finish time</dt><dd>' + fmtTime(total) + '</dd></div>' +
    '<div><dt>Speed</dt><dd>' + (S.unit === 'mi' ? (kmh / MI).toFixed(1) + '<small>mph</small>' : kmh.toFixed(1) + '<small>km/h</small>') + '</dd></div>' +
    '<div><dt>Every 400 m</dt><dd>' + fmtTime(S.pace * .4) + '</dd></div>';

  el.paceTbl.innerHTML = el.paceTbl.querySelector('caption').outerHTML +
    '<thead><tr><th scope="col">Race</th><th scope="col">Finish time</th></tr></thead><tbody>' +
    RACES.slice().reverse().map(function(r){ var you = Math.abs(r.km - km) < 0.006;
      return '<tr' + (you ? ' class="is-you"' : '') + '><th scope="row">' + r.n + '</th><td>' + fmtTime(S.pace * r.km) + '</td></tr>'; }).join('') + '</tbody>';
}

/* ---------- inputs ---------- */
function setDistance(km){
  km = clamp(km, 1.5, 42.195);
  if (S.tab === 'vdot'){ var V = vdotOf(S.km, S.sec); S.sec = Math.round(raceSec(km, V)); }   // keep your fitness: time follows the new distance
  S.km = km; render();
}
el.dist.addEventListener('input', function(){ var v = +this.value; var r = raceFor(v) || (Math.abs(v - 42.2) < 0.05 ? RACES[7] : Math.abs(v - 21.1) < 0.05 ? RACES[6] : null); setDistance(r ? r.km : v); });
el.chips.addEventListener('click', function(e){ var b = e.target.closest('button'); if (b) setDistance(RACES[+b.getAttribute('data-i')].km); });
el.time.addEventListener('input', function(){ S.sec = +this.value; render(); });
el.pace.addEventListener('input', function(){ S.pace = +this.value; render(); });

function bindPill(input, apply){
  function commit(){ var ok = apply(input.value); if (ok){ input.removeAttribute('aria-invalid'); input.blur(); render(); } else input.setAttribute('aria-invalid', 'true'); }
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); commit(); } });
  input.addEventListener('change', commit);
  input.addEventListener('blur', function(){ setTimeout(render, 0); });
  input.addEventListener('focus', function(){ this.select(); });
}
bindPill(el.distIn, function(v){ var n = parseFloat(String(v).replace(',', '.')); if (!(n > 0)) return false; var km = S.unit === 'mi' ? n * MI : n; if (km < 1.5 || km > 42.3) return false; setDistance(raceFor(km) ? raceFor(km).km : km); return true; });
bindPill(el.timeIn, function(v){ var s = parseTime(v); if (!(s > 0) || s < S.km * PACE_MIN || s > S.km * PACE_MAX) return false; S.sec = Math.round(s); return true; });
bindPill(el.paceIn, function(v){ var s = parseTime(v); if (String(v).indexOf(':') === -1 && /^\d{3,4}$/.test(String(v).trim())) s = parseTime(String(v).trim().replace(/(\d{2})$/, ':$1')); if (!(s > 0)) return false; s = S.unit === 'mi' ? s / MI : s; if (s < PACE_MIN || s > PACE_MAX) return false; S.pace = Math.round(s); return true; });

/* tabs (arrow keys move between them) */
var tabs = $$('[role="tab"]');
function showTab(name){
  if (name === S.tab) return;
  if (name === 'pace') S.pace = S.sec / S.km; else S.sec = Math.round(S.pace * S.km);   // carry the numbers across (exact, so the finish time doesn't jump)
  S.tab = name;
  tabs.forEach(function(t){ var on = t.id === (name === 'vdot' ? 'tabVdot' : 'tabPace'); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  $$('[data-tab]').forEach(function(r){ r.hidden = r.getAttribute('data-tab') !== name; });
  $('#resVdot').hidden = name !== 'vdot'; $('#resPace').hidden = name !== 'pace';
  render();
}
tabs.forEach(function(t, i){
  t.addEventListener('click', function(){ showTab(t.id === 'tabVdot' ? 'vdot' : 'pace'); });
  t.addEventListener('keydown', function(e){ if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ var n = tabs[(i + 1) % 2]; n.focus(); n.click(); } });
});
$$('.units button').forEach(function(b){
  b.addEventListener('click', function(){ S.unit = b.getAttribute('data-unit'); $$('.units button').forEach(function(x){ x.setAttribute('aria-checked', String(x === b)); }); render(); });
});

/* ---------- shareable link: ?d=10&t=45:00  or  ?tab=pace&d=21.1&p=5:00 ---------- */
var urlTimer;
function saveUrl(){
  clearTimeout(urlTimer);
  urlTimer = setTimeout(function(){
    var q = new URLSearchParams(); if (S.tab === 'pace') q.set('tab', 'pace');
    q.set('d', String(Math.round(S.km * 10000) / 10000));
    if (S.tab === 'pace') q.set('p', fmtTime(S.pace)); else q.set('t', fmtTime(S.sec));
    if (S.unit === 'mi') q.set('u', 'mi');
    try { history.replaceState(null, '', '?' + q.toString()); } catch (e) {}
  }, 250);
}
(function load(){
  var q = new URLSearchParams(location.search), d = parseFloat(q.get('d')), t = parseTime(q.get('t') || ''), p = parseTime(q.get('p') || '');
  if (d >= 1.5 && d <= 42.195) S.km = d;
  if (t > 0) S.sec = Math.round(t); else S.sec = Math.round(raceSec(S.km, vdotOf(10, 2700)));
  if (p > 0) S.pace = Math.round(p); else S.pace = Math.round(S.sec / S.km);
  if (q.get('u') === 'mi'){ S.unit = 'mi'; $$('.units button').forEach(function(x){ x.setAttribute('aria-checked', String(x.getAttribute('data-unit') === 'mi')); }); }
  render();
  if (q.get('tab') === 'pace'){ var keep = S.pace; showTab('pace'); S.pace = keep; render(); }
})();

$('#shareBtn').addEventListener('click', function(){
  var msg = $('#shareMsg'), url = location.href;
  function done(t){ msg.textContent = t; setTimeout(function(){ msg.textContent = ''; }, 2500); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function(){ done('Link copied — send it to your running buddy.'); }, function(){ done('Copy the link from the address bar.'); });
  else done('Copy the link from the address bar.');
});

/* ---------- page chrome: footer year + mobile menu ---------- */
var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
var sheet = $('#sheet'), menuBtn = $('#menuBtn');
function menu(open){ sheet.classList.toggle('open', open); document.body.classList.toggle('menu-open', open); sheet.setAttribute('aria-hidden', String(!open)); menuBtn.setAttribute('aria-expanded', String(open)); if (open) $('#sheetClose').focus(); }
menuBtn.addEventListener('click', function(){ menu(true); });
$('#sheetClose').addEventListener('click', function(){ menu(false); menuBtn.focus(); });
addEventListener('keydown', function(e){ if (e.key === 'Escape' && sheet.classList.contains('open')){ menu(false); menuBtn.focus(); } });
$$('#sheet a').forEach(function(a){ a.addEventListener('click', function(){ menu(false); }); });

/* ---------- "What's VDOT?" info modal (native <dialog>) ---------- */
var info = $('#vdotInfo'), opener = null;
function closeInfo(){ if (info.open) info.close(); }
$$('[data-open-info]').forEach(function(b){
  b.addEventListener('click', function(){
    opener = b;
    if (typeof info.showModal === 'function'){ info.showModal(); document.body.classList.add('modal-open'); }
    else info.setAttribute('open', '');                                   // very old browsers: shows inline
    $('.modal__x', info).focus();
  });
});
$$('[data-close-info]').forEach(function(b){ b.addEventListener('click', closeInfo); });
info.addEventListener('click', function(e){ if (e.target === info) closeInfo(); });   // click on the dark backdrop
info.addEventListener('close', function(){ document.body.classList.remove('modal-open'); if (opener) opener.focus(); });

// Linked from the home page as vdotcalculator/#whats-vdot: open the guide straight away.
if (location.hash === '#whats-vdot'){ var ib = $('[data-open-info]'); if (ib) ib.click(); }

/* exposed for tests in the browser console */
window.PCS_VDOT = { vdotOf: vdotOf, raceSec: raceSec, paceAt: paceAt, fmtTime: fmtTime };
})();
