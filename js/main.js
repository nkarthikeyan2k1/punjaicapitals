/* =====================================================================
   DRAFT 5A — loader, hero logo, menu, registration (→ Google Sheet), live race results.
   ===================================================================== */
(function(){
'use strict';
/* Join form → Google Sheet. Paste the Apps Script "Web app URL" here (see apps-script/Code.gs for the script and steps).
   Every field in the form with a name="…" is sent; the name becomes the column header in the sheet. */
var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby5gG6PG9QN8j1x4t26fGdxGFGuZouF_Sx0czcO5zuuJFZ_4ZqIqJqBkTPxuyJcUhk/exec';   // e.g. 'https://script.google.com/macros/s/AKfy…/exec' — public by design: it can only ADD a row
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#year').textContent = new Date().getFullYear();
var BIB = 'PCSC-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));

/* ---------- Mobile menu ---------- */
var sheet = $('#sheet'), menuBtn = $('#menuBtn');
function menu(open){ sheet.classList.toggle('open', open); document.body.classList.toggle('menu-open', open); sheet.setAttribute('aria-hidden', String(!open)); menuBtn.setAttribute('aria-expanded', String(open)); if (open) $('#sheetClose').focus(); }
addEventListener('keydown', function(e){ if (e.key === 'Escape' && sheet.classList.contains('open')){ menu(false); menuBtn.focus(); } });
menuBtn.addEventListener('click', function(){ menu(true); });
$('#sheetClose').addEventListener('click', function(){ menu(false); menuBtn.focus(); });
$$('#sheet a').forEach(function(a){ a.addEventListener('click', function(){ menu(false); }); });

/* ---------- Loader → logo flies into the hero mark, then floats gently ---------- */
var pre = $('#pre'), badge = $('#heroMark'), badgeWave = $('#heroWave'), badgeIcon = $('#heroIcon'), revealed = false;
function float(){
  if (REDUCE) return;
  (function f(now){ var t = now / 1000; badgeWave.style.transform = 'translate3d(0,' + (Math.sin(t * 1.6) * 5).toFixed(1) + 'px,0) rotate(' + (Math.sin(t * 1.6 + .9) * 2.5).toFixed(2) + 'deg)'; requestAnimationFrame(f); })(performance.now());
}
function reveal(){
  if (revealed) return; revealed = true;
  document.body.classList.add('loaded');
  var icon = $('#preIcon'), ir = icon.getBoundingClientRect(), tr = badgeIcon.getBoundingClientRect();
  if (REDUCE || !ir.width || !tr.width || tr.bottom < 0 || tr.top > innerHeight){ pre.classList.add('done'); badge.classList.add('on'); float(); return; }
  var fly = icon.cloneNode(); fly.className = 'flyer'; fly.removeAttribute('id');
  fly.style.left = ir.left + 'px'; fly.style.top = ir.top + 'px'; fly.style.width = ir.width + 'px'; fly.style.height = ir.height + 'px';
  document.body.appendChild(fly); icon.style.visibility = 'hidden'; pre.classList.add('done');
  var s = tr.width / ir.width, dx = tr.left - ir.left, dy = tr.top - ir.top;
  var anim = fly.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: 'translate(' + (dx * .55) + 'px,' + (dy * .55 - 50) + 'px) scale(' + (1 + (s - 1) * .55) + ') rotate(-6deg)', offset: .6 },
    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' }
  ], { duration: 1000, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
  setTimeout(function(){ badge.classList.add('on'); }, 650);
  anim.onfinish = function(){ fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = function(){ fly.remove(); }; float(); };
}
$('#preSkip').addEventListener('click', reveal);
setTimeout(reveal, REDUCE ? 200 : 1950);

/* ---------- Carousels: dots under every .carousel (scroll, swipe or tap a dot) ---------- */
$$('.carousel').forEach(function(c){
  var dots = document.createElement('div'), stops = [], raf = 0;
  dots.className = 'dots'; dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', (c.getAttribute('aria-label') || 'Carousel') + ' · pages');
  c.parentNode.insertBefore(dots, c.nextSibling);
  function setup(){
    var cols = [];
    Array.prototype.forEach.call(c.children, function(k){ if (cols.indexOf(k.offsetLeft) < 0) cols.push(k.offsetLeft); });
    cols.sort(function(a, b){ return a - b; });
    var x0 = cols[0] || 0, w = c.clientWidth, per = cols.filter(function(x){ return x - x0 < w - 4; }).length || 1;
    var max = c.scrollWidth - w, pages = Math.ceil(cols.length / per);
    stops = []; for (var i = 0; i < pages; i++) stops.push(Math.min(cols[i * per] - x0, max));
    dots.hidden = pages < 2 || max < 4;
    dots.innerHTML = stops.map(function(_, i){ return '<button type="button" aria-label="Page ' + (i + 1) + ' of ' + pages + '"></button>'; }).join('');
    $$('button', dots).forEach(function(b, i){ b.addEventListener('click', function(){ c.scrollTo({ left: stops[i], behavior: REDUCE ? 'auto' : 'smooth' }); }); });
    sync();
  }
  function sync(){
    raf = 0; var x = c.scrollLeft, max = c.scrollWidth - c.clientWidth, cur = 0, best = 1e9;
    stops.forEach(function(s, i){ var d = Math.abs(s - x); if (d < best){ best = d; cur = i; } });
    if (x >= max - 4) cur = stops.length - 1;
    $$('button', dots).forEach(function(b, i){ b.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
  }
  c.addEventListener('scroll', function(){ if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
  var t; addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(setup, 150); });
  addEventListener('load', setup);
  setup();
});

/* ---------- Registration → Google Sheet ----------
   Everything comes from the HTML: steps = <fieldset class="step"> (title = its <legend>),
   fields = any input/select/textarea with a name (= sheet column), rules = required / data-check / data-msg. */
var form = $('#joinForm'), steps = $$('.step', form), stepN = 1, LAST = steps.length, result = $('#result');
var titles = steps.map(function(st){ var l = $('legend', st); return l ? l.textContent.trim() : ''; });
// The step bar is written in the HTML (so it shows even before this script runs); rebuild it only if a step was added or removed.
var track = $('.track', form);
if (track.children.length !== LAST){
  track.innerHTML = titles.map(function(t, i){ return '<span' + (i ? '' : ' class="on"') + '>' + (i + 1) + ' · ' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join('');
}
track.style.gridTemplateColumns = 'repeat(' + LAST + ',minmax(0,1fr))';
var fields = function(scope){ return $$('input[name],select[name],textarea[name]', scope); };
var val = function(el){ return el.type === 'checkbox' ? (el.checked ? 'Yes' : 'No') : String(el.value).trim(); };
var T0 = Date.now();
function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
$$('input[type="date"]', form).forEach(function(el){       // no future dates; a date of birth also needs the minimum age
  if (el.max) return;
  var d = new Date(), age = +el.getAttribute('data-min-age') || 0; d.setFullYear(d.getFullYear() - age); el.max = isoDate(d);
});
$$('[data-check="mobile"]', form).forEach(function(el){ el.addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); }); });
function labelOf(el){ var l = el.id && $('label[for="' + el.id + '"]', form); return l ? l.textContent.replace(/\s*\*|\(optional\)/g, '').trim() : el.name; }
function check(n){
  $$('[aria-invalid]', form).forEach(function(x){ x.removeAttribute('aria-invalid'); });
  var list = fields(steps[n - 1]);
  for (var i = 0; i < list.length; i++){
    var el = list[i], v = val(el), kind = el.getAttribute('data-check'), why = '';
    if (el.name.charAt(0) === '_') continue;                                       // internal (honeypot)
    if (el.required && (el.type === 'checkbox' ? !el.checked : !v)) why = 'missing';
    else if (v && el.type !== 'checkbox'){
      if (kind === 'mobile' && !/^[6-9]\d{9}$/.test(v)) why = 'format';
      else if (kind === 'name' && !/^\p{L}[\p{L}\p{M} .'-]{1,99}$/u.test(v)) why = 'format';
      else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) why = 'format';
      else if (el.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || (el.min && v < el.min) || (el.max && v > el.max))) why = 'range';
      else if (el.getAttribute('data-differs')){ var o = $('#' + el.getAttribute('data-differs')); if (o && val(o) === v) why = 'same'; }
    }
    if (why){
      result.className = 'err';
      result.textContent = el.getAttribute('data-msg-' + why) || el.getAttribute('data-msg') ||
        (el.type === 'checkbox' ? 'Please tick the box to continue.' : 'Please check: ' + labelOf(el) + '.');
      el.setAttribute('aria-invalid', 'true'); el.focus(); return false;
    }
  }
  result.className = ''; result.textContent = ''; return true;
}
function nextLabel(n){ return n < LAST ? 'Next: ' + titles[n].toLowerCase() : 'Submit registration'; }
function go(n){
  stepN = n; steps.forEach(function(st, i){ st.classList.toggle('on', i === n - 1); });
  $$('.track span', form).forEach(function(sp, i){ sp.classList.toggle('on', i < n); });
  $('#stepTitle').textContent = titles[n - 1]; $('#stepCount').textContent = 'STEP ' + n + ' OF ' + LAST + ' · * REQUIRED';
  $('#backBtn').disabled = n === 1; $('#nextBtn').textContent = nextLabel(n);
  var first = $('.step.on input, .step.on select, .step.on textarea', form); if (first) first.focus({ preventScroll: true });
}
go(1);
$('#backBtn').addEventListener('click', function(){ if (stepN > 1) go(stepN - 1); });
$('#nextBtn').addEventListener('click', function(){ if (!check(stepN)) return; if (stepN < LAST) go(stepN + 1); else submit(); });
form.addEventListener('submit', function(e){ e.preventDefault(); $('#nextBtn').click(); });
function success(n){
  $$('.step,.form__foot,.track,.step__head', form).forEach(function(x){ x.style.display = 'none'; });
  $('#doneTitle').textContent = "You're in, " + n.split(' ')[0] + '!';
  $('#bib').textContent = BIB;
  var dc = $('#doneCard'); dc.classList.add('on'); dc.focus();
  document.dispatchEvent(new CustomEvent('pcs:registered', { detail: { name: n, bib: BIB } }));
}
var busy = false;
function submit(){
  if (busy) return;
  for (var s = 1; s <= LAST; s++) if (!check(s)){ go(s); check(s); return; }       // re-check every step before sending
  var data = {}; fields(form).forEach(function(el){ data[el.name] = val(el); });
  data['Club number'] = BIB; data._t = Math.round((Date.now() - T0) / 1000);      // seconds on the page (bots are instant)
  var n = data['Full name'] || '', btn = $('#nextBtn');
  if (data._hp){ success(n); return; }                                             // a bot filled the hidden field: pretend it worked
  if (SCRIPT_URL.indexOf('PASTE') === 0){ result.className = ''; result.textContent = 'Demo mode: the form works, but it is not connected to the Google Sheet yet.'; success(n); return; }
  busy = true; btn.disabled = true; btn.textContent = 'Submitting…'; result.className = ''; result.textContent = 'Submitting your registration…';
  // text/plain keeps this a "simple" request, so the browser can read the Apps Script reply without a CORS preflight.
  fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) })
    .then(function(x){ return x.json(); })
    .then(function(j){ if (!j || !j.ok) throw new Error('fail'); result.textContent = ''; success(n); form.reset(); })
    .catch(function(){ result.className = 'err'; result.textContent = 'Could not submit. Please check your connection and try again, or email punjaicapitalsclub@gmail.com.'; })
    .then(function(){ busy = false; btn.disabled = false; btn.textContent = nextLabel(LAST); });
}
})();

/* ---------- Club records: live official results from MyRaceIndia ----------
   A record card with data-myrace="Event Name|Bib" gets its time and overall rank from MyRaceIndia's public results API.
   The values already written in the card stay as the fallback when the API is slow or down. */
(function(){
  var cards = document.querySelectorAll('[data-myrace]'); if (!cards.length || !window.fetch) return;
  var API = 'https://admin.myraceindia.com/index.php/ControlApi/Record/Bib/';
  function time(t){ return String(t).replace(/^00:/, '').replace(/^0(\d:)/, '$1'); }            // 00:45:37 → 45:37, 01:42:42 → 1:42:42
  function nth(n){ var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  Array.prototype.forEach.call(cards, function(card){
    var p = card.getAttribute('data-myrace').split('|'); if (p.length < 2) return;
    fetch(API + encodeURIComponent(p[1].trim()) + '/Event_Name/' + encodeURIComponent(p[0].trim()))
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var r = j && j[0]; if (!r || !r.Net_Time || r.Net_Time === '00:00:00') return;
        card.querySelector('[data-f="time"]').textContent = time(r.Net_Time);
        var m = /(\d+)\s*\/\s*(\d+)/.exec(r.OverallRank || r.TotalRank || '');
        if (m) card.querySelector('[data-f="rank"]').textContent = nth(+m[1]) + ' of ' + (+m[2]).toLocaleString('en-IN');
        card.setAttribute('data-live', 'ok');
      })
      .catch(function(){});
  });
})();

/* ---------- Gobi race-day reel ---------- */
(function(){
  var v = document.getElementById('gobiReel'), b = document.getElementById('reelBtn'); if (!v || !b) return;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches, user = null;
  function ui(){ var on = !v.paused; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.querySelector('span').textContent = on ? 'Pause' : 'Play';
    b.querySelector('path').setAttribute('d', on ? 'M3 2H6V12H3ZM8 2H11V12H8Z' : 'M3 2V12L12 7Z'); }
  v.addEventListener('play', ui); v.addEventListener('pause', ui);
  b.addEventListener('click', function(){ if (v.paused){ user = true; v.play().catch(function(){}); } else { user = false; v.pause(); } });
  if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ es.forEach(function(e){
    if (e.isIntersecting){ if (!RM && user !== false){ v.preload = 'auto'; v.play().catch(function(){}); } } else if (!v.paused) v.pause();
  }); }, { threshold: .35 }).observe(v);
})();

/* ---------- VDOT calculator promo: ring fills and number counts up once, when it scrolls into view ---------- */
(function(){
  var box = document.querySelector('.vpromo'), num = document.getElementById('vpromoNum');
  if (!box || !num || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var to = parseFloat(num.getAttribute('data-to'));
  box.classList.add('is-wait'); num.textContent = '0.0';
  var io = new IntersectionObserver(function(es){
    if (!es[0].isIntersecting) return;
    io.disconnect();
    box.getBoundingClientRect();                       // commit the empty ring before animating it
    box.classList.remove('is-wait');
    var t0 = null;
    (function step(t){
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
      num.textContent = (to * e).toFixed(1);
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }, { threshold: .5 });
  io.observe(box);
})();
