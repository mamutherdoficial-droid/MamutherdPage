/* Mamut Herd — viaje entre secciones.
   Al tocar un enlace interno, una puerta de dos hojas se cierra sobre la
   página con el sello de Mamut como broche, el broche se traba, la página
   salta al destino y la puerta se abre ya en el otro lado. Entre páginas
   del sitio, la puerta se cierra aquí y se abre en la página nueva.

   Se anima con la Web Animations API (no con CSS ni GSAP), así que se ve
   aunque el navegador o el sistema tengan reducidos los efectos.
   Los sonidos se crean en el navegador (Web Audio), no hay archivos de
   sonido. El botón de sonido del encabezado los silencia y la elección
   se recuerda en este navegador. */
(function () {
  'use strict';
  var KEY = 'mamut-sonido';
  var FLAG = 'mamut-puerta';
  var CLOSE_MS = 480, LATCH_MS = 200, HOLD_MS = 140, OPEN_MS = 640;
  var script = document.currentScript;
  var sealSrc = new URL('../marca/sello-miembro-color.svg', script ? script.src : window.location.href).href;

  /* ---------- Preferencia de sonido ---------- */
  var soundOn = true;
  try { soundOn = window.localStorage.getItem(KEY) !== 'no'; } catch (e) { soundOn = true; }
  var toggle = document.querySelector('.sound-btn');
  function paintToggle() {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    toggle.setAttribute('aria-label', soundOn ? 'Silenciar el sonido de navegación' : 'Activar el sonido de navegación');
    toggle.classList.toggle('is-off', !soundOn);
  }
  paintToggle();
  if (toggle) {
    toggle.addEventListener('click', function () {
      soundOn = !soundOn;
      try { window.localStorage.setItem(KEY, soundOn ? 'si' : 'no'); } catch (e) { /* sin almacenamiento: solo esta visita */ }
      paintToggle();
      if (soundOn) latchSound(0);
    });
  }

  /* ---------- Sonidos ---------- */
  var ac = null, noise = null;
  function audio() {
    if (ac) return ac;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    var len = Math.floor(ac.sampleRate * 2);
    noise = ac.createBuffer(1, len, ac.sampleRate);
    var d = noise.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {           /* ruido "café": más grave y suave que el blanco */
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return ac;
  }
  function ready() {
    if (!soundOn) return null;
    var ctx = audio(); if (!ctx) return null;
    if (ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    return ctx;
  }
  /* Aire que mueven las hojas al pasar */
  function airSound(delay, seconds, from, to) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay, dur = seconds;
    var src = ctx.createBufferSource(); src.buffer = noise;
    var band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 0.8;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band); band.connect(gain); gain.connect(ctx.destination);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  /* Golpe sordo de las dos hojas al juntarse */
  function thudSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    var osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.7, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.4);
    var src = ctx.createBufferSource(); src.buffer = noise;
    var low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 600;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.8, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(low); low.connect(ng); ng.connect(ctx.destination);
    src.start(t, Math.random()); src.stop(t + 0.2);
  }
  /* Clic metálico del broche: dos golpecitos y un pequeño tintineo */
  function latchSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t0 = ctx.currentTime + delay;
    [0, 0.065].forEach(function (off, i) {
      var t = t0 + off;
      var src = ctx.createBufferSource(); src.buffer = noise;
      var high = ctx.createBiquadFilter(); high.type = 'bandpass'; high.frequency.value = i ? 3200 : 2400; high.Q.value = 2.5;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i ? 0.5 : 0.35, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      src.connect(high); high.connect(g); g.connect(ctx.destination);
      src.start(t, Math.random()); src.stop(t + 0.06);
    });
    var ping = ctx.createOscillator(); ping.type = 'triangle';
    ping.frequency.setValueAtTime(1850, t0 + 0.065);
    var pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, t0 + 0.065);
    pg.gain.exponentialRampToValueAtTime(0.08, t0 + 0.07);
    pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    ping.connect(pg); pg.connect(ctx.destination);
    ping.start(t0 + 0.065); ping.stop(t0 + 0.22);
  }
  function closeSounds() {
    airSound(0, CLOSE_MS / 1000, 260, 900);
    thudSound(CLOSE_MS / 1000 - 0.01);
    latchSound(CLOSE_MS / 1000 + 0.06);
  }
  function openSounds() {
    latchSound(0);
    airSound(0.12, OPEN_MS / 1000 + 0.1, 900, 280);
  }

  /* ---------- La puerta ---------- */
  var door = document.createElement('div');
  door.className = 'door';
  door.setAttribute('aria-hidden', 'true');
  door.innerHTML =
    '<div class="door__leaf door__leaf--l"><img class="door__seal" alt="" src="' + sealSrc + '"></div>' +
    '<div class="door__leaf door__leaf--r"><img class="door__seal" alt="" src="' + sealSrc + '"></div>';
  document.body.appendChild(door);
  var leafL = door.querySelector('.door__leaf--l');
  var leafR = door.querySelector('.door__leaf--r');
  var seals = door.querySelectorAll('.door__seal');
  var canAnimate = typeof door.animate === 'function';

  function wait(ms) { return new Promise(function (res) { window.setTimeout(res, ms); }); }
  function play(el, frames, ms, easing) {
    if (!canAnimate) return Promise.resolve();
    var a = el.animate(frames, { duration: ms, easing: easing, fill: 'both' });
    return new Promise(function (res) {
      a.onfinish = function () { res(a); };
      a.oncancel = function () { res(a); };
    });
  }
  var lastAnims = [];
  function settle(anims, closed) {   /* deja el estado final en clases y suelta las animaciones */
    door.classList.toggle('is-closed', closed);
    door.classList.toggle('is-shown', closed);
    anims.forEach(function (a) { if (a && a.cancel) a.cancel(); });
  }
  function clearAnims() { lastAnims.forEach(function (a) { if (a && a.cancel) a.cancel(); }); lastAnims = []; }

  function closeDoor() {
    clearAnims();
    door.classList.add('is-shown');
    door.classList.remove('is-closed');
    closeSounds();
    var ease = 'cubic-bezier(.45, 0, .85, .55)';   /* acelera hasta el golpe */
    return Promise.all([
      play(leafL, [{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], CLOSE_MS, ease),
      play(leafR, [{ transform: 'translateX(101%)' }, { transform: 'translateX(0)' }], CLOSE_MS, ease),
      play(seals[0], [{ transform: 'rotate(-40deg)' }, { transform: 'rotate(-40deg)' }], CLOSE_MS, 'linear'),
      play(seals[1], [{ transform: 'rotate(-40deg)' }, { transform: 'rotate(-40deg)' }], CLOSE_MS, 'linear')
    ]).then(function (anims) {
      settle(anims.slice(0, 2), true);
      lastAnims = anims.slice(2);
      return latch();
    });
  }
  /* El broche gira y se traba con un pequeño latido */
  function latch() {
    var frames = [
      { transform: 'rotate(-40deg) scale(1)' },
      { transform: 'rotate(6deg) scale(1.1)', offset: 0.7 },
      { transform: 'rotate(0deg) scale(1)' }
    ];
    var ease = 'cubic-bezier(.3, 1.4, .5, 1)';
    return Promise.all([play(seals[0], frames, LATCH_MS, ease), play(seals[1], frames, LATCH_MS, ease)])
      .then(function (anims) { clearAnims(); anims.forEach(function (a) { if (a && a.cancel) a.cancel(); }); });
  }
  function openDoor(withSound) {
    clearAnims();
    door.classList.add('is-shown', 'is-closed');
    if (withSound) openSounds();
    var unlatch = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-40deg)' }];
    return Promise.all([play(seals[0], unlatch, 160, 'ease-in'), play(seals[1], unlatch, 160, 'ease-in')])
      .then(function (sealAnims) {
        lastAnims = sealAnims;
        var ease = 'cubic-bezier(.25, .1, .2, 1)';
        return Promise.all([
          play(leafL, [{ transform: 'translateX(0)' }, { transform: 'translateX(-101%)' }], OPEN_MS, ease),
          play(leafR, [{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], OPEN_MS, ease)
        ]);
      })
      .then(function (anims) { clearAnims(); settle(anims, false); });
  }

  /* ---------- Enlaces ---------- */
  var busy = false;
  var here = window.location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  function samePage(url) {
    var p = url.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
    return url.origin === window.location.origin && p === here;
  }
  function jumpTo(target) {   /* salto instantáneo, sin desplazamiento suave */
    var root = document.documentElement, prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    if (target === document.body) window.scrollTo(0, 0); else target.scrollIntoView();
    root.style.scrollBehavior = prev;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.classList.contains('skip')) return;
    var href = a.getAttribute('href');
    if (/^(mailto:|tel:|https?:\/\/(?!$))/i.test(href) && !href.startsWith(window.location.origin)) return;
    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;

    if (samePage(url) && url.hash) {
      var target = url.hash === '#' ? document.body : document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      if (busy) return;
      busy = true;
      closeDoor()
        .then(function () { return wait(HOLD_MS); })
        .then(function () {
          jumpTo(target);
          if (history.pushState) history.pushState(null, '', url.hash);
          target.setAttribute('tabindex', '-1');
          return wait(40);
        })
        .then(function () { return openDoor(true); })
        .then(function () { target.focus({ preventScroll: true }); busy = false; }, function () { busy = false; });
      return;
    }

    if (!samePage(url)) {           /* otra página del sitio: se cierra aquí y se abre allá */
      e.preventDefault();
      if (busy) return;
      busy = true;
      try { window.sessionStorage.setItem(FLAG, '1'); } catch (err) { /* la página nueva llegará sin puerta */ }
      closeDoor().then(function () { window.location.href = url.href; }, function () { window.location.href = url.href; });
    }
  });

  /* Al llegar desde otra página del sitio: la puerta está cerrada y se abre. */
  var root = document.documentElement;
  var arriving = root.classList.contains('door-arrive');
  try { window.sessionStorage.removeItem(FLAG); } catch (e) { /* nada */ }
  if (arriving) {
    door.classList.add('is-shown', 'is-closed');
    root.classList.remove('door-arrive');
    var img = seals[0];
    var sealReady = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    Promise.race([sealReady, wait(600)])
      .then(function () { return wait(220); })
      .then(function () { return openDoor(true); });   /* el sonido solo suena si el navegador lo permite sin un clic */
  }

  /* Al volver con "atrás", la página puede venir de la caché con la puerta cerrada. */
  window.addEventListener('pageshow', function (e) {
    busy = false;
    if (e.persisted && door.classList.contains('is-closed')) openDoor(false);
  });
})();
