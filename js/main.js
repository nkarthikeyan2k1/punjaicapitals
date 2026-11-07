/* =====================================================================
   DRAFT 5A — loader, hero logo, menu, 2-step registration (→ Google Form), live race results.
   ===================================================================== */
(function(){
'use strict';
/* Join form → Google Form. Responses land in the Google Form (and its linked Google Sheet).
   1. In the Google Form: Send → link → copy the id between /d/e/ and /viewform → paste as GFORM.id
   2. ⋮ → "Get pre-filled link", fill every question with any text, "Get link" → each entry.NNNN in that link
      belongs to one question: paste them below. Leave a field '' to skip it. */
var GFORM = {
  id: 'PASTE_GOOGLE_FORM_ID_HERE',
  fields: {
    name: 'entry.', mobile: 'entry.', dob: 'entry.', gender: 'entry.', level: 'entry.', area: 'entry.',
    ecName: 'entry.', ecPhone: 'entry.', blood: 'entry.', jersey: 'entry.', health: 'entry.', member: 'entry.'
  }
};
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

/* ---------- Share links (after registering) ---------- */
function pageUrl(){ return /^https?:/.test(location.href) ? location.href.split('#')[0] : 'https://www.instagram.com/punjaicapitals'; }
function links(){
  var t = encodeURIComponent('I just joined Punjai Capitals Sports Club, a free running and cycling club in Punjai Puliampatti. Come run with us!'), u = encodeURIComponent(pageUrl());
  $('#shWa').href = 'https://wa.me/?text=' + t + '%20' + u;
  $('#shX').href = 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u + '&hashtags=PunjaiCapitals';
  $('#shFb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
}
links();

/* ---------- Registration: 2 short steps → Google Form ---------- */
var form = $('#joinForm'), steps = $$('.step', form), stepN = 1, LAST = steps.length, result = $('#result');
var titles = ['About you', 'Safety & kit'], nexts = ['Next: safety & kit', 'Submit registration'];
var v = function(i){ return $('#' + i).value.trim(); };
var today = new Date(); $('#dob').max = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
['phone', 'ecPhone'].forEach(function(id){ $('#' + id).addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); }); });
var REQ = {
  1: [['name', 'Please enter your full name.'], ['phone', 'Enter a valid 10-digit mobile number.', 'tel'], ['dob', 'Please select your date of birth.'], ['gender', 'Please select your gender.'], ['level', 'Please select your experience.'], ['area', 'Please enter your area or village.']],
  2: [['ecName', 'Please enter the emergency contact name.'], ['ecPhone', 'Enter a valid 10-digit emergency contact number.', 'tel'], ['blood', 'Please select your blood group.'], ['kit', 'Please select your jersey size.'], ['consent', 'Please tick the box to confirm.', 'check']]
};
function check(n){
  $$('[aria-invalid]', form).forEach(function(x){ x.removeAttribute('aria-invalid'); });
  var list = REQ[n];
  for (var i = 0; i < list.length; i++){
    var id = list[i][0], msg = list[i][1], kind = list[i][2], el = $('#' + id), bad;
    if (kind === 'tel') bad = !/^[6-9]\d{9}$/.test(el.value);
    else if (kind === 'check') bad = !el.checked;
    else bad = !v(id);
    if (bad){ result.className = 'err'; result.textContent = msg; el.setAttribute('aria-invalid', 'true'); el.focus(); return false; }
  }
  result.className = ''; result.textContent = ''; return true;
}
function go(n){
  stepN = n; steps.forEach(function(s){ s.classList.toggle('on', +s.getAttribute('data-step') === n); });
  $$('.track span').forEach(function(s, i){ s.classList.toggle('on', i < n); });
  $('#stepTitle').textContent = titles[n - 1]; $('#stepCount').textContent = 'STEP ' + n + ' OF ' + LAST + ' · * REQUIRED';
  $('#backBtn').disabled = n === 1; $('#nextBtn').textContent = nexts[n - 1];
  var first = $('.step.on input, .step.on select', form); if (first) first.focus({ preventScroll: true });
}
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
function submit(){
  var n = v('name'), btn = $('#nextBtn');
  var data = { name: n, mobile: $('#phone').value, dob: $('#dob').value, gender: v('gender'), level: v('level'), area: v('area'),
               ecName: v('ecName'), ecPhone: $('#ecPhone').value, blood: v('blood'), jersey: v('kit'), health: v('health') || 'None', member: BIB };
  if (GFORM.id.indexOf('PASTE') === 0){ result.className = ''; result.textContent = 'Demo mode: the form works, but it is not connected to the Google Form yet.'; success(n); return; }
  var body = new URLSearchParams();
  Object.keys(GFORM.fields).forEach(function(k){ var e = GFORM.fields[k]; if (e && e !== 'entry.' && data[k] !== undefined) body.append(e, data[k]); });
  btn.disabled = true; btn.textContent = 'Submitting…'; result.className = ''; result.textContent = 'Submitting your registration…';
  // Google Forms sends no CORS headers, so the reply is opaque: a resolved fetch means the response was delivered.
  fetch('https://docs.google.com/forms/d/e/' + GFORM.id + '/formResponse', { method: 'POST', mode: 'no-cors', body: body })
    .then(function(){ result.textContent = ''; success(n); form.reset(); })
    .catch(function(){ result.className = 'err'; result.textContent = 'Could not submit. Please check your connection and try again, or email punjaicapitalsclub@gmail.com.'; })
    .then(function(){ btn.disabled = false; btn.textContent = nexts[LAST - 1]; });
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
