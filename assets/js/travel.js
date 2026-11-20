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
  var CLOSE_MS = 600, LATCH_MS = 300, UNLATCH_MS = 220, HOLD_MS = 140, OPEN_MS = 720;
  var MASTER = 1;   /* volumen general de los sonidos (el limitador evita que distorsione) */
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
      if (soundOn) lockSound(0);
    });
  }

  /* ---------- Sonidos: puerta pesada de metal ----------
     Todo sale de ruido filtrado, sin tonos de sintetizador: las hojas se
     arrastran por el riel con fricción irregular, chocan con un golpe grave
     que hace resonar el acero, y el broche se traba con un "ka-chunk". */
  var ac = null, white = null, out = null, room = null;
  function audio() {
    if (ac) return ac;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    var len = Math.floor(ac.sampleRate * 2);
    white = ac.createBuffer(1, len, ac.sampleRate);
    var w = white.getChannelData(0);
    for (var i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    /* Limitador al final: permite subir el volumen sin que distorsione */
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -3; comp.knee.value = 2; comp.ratio.value = 12;
    comp.attack.value = 0.001; comp.release.value = 0.25;
    var master = ac.createGain(); master.gain.value = MASTER;
    comp.connect(master); master.connect(ac.destination);
    out = ac.createGain(); out.gain.value = 1; out.connect(comp);
    /* Eco de un recinto grande de concreto */
    var rlen = Math.floor(ac.sampleRate * 1.4), ir = ac.createBuffer(2, rlen, ac.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c);
      for (var j = 0; j < rlen; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / rlen, 4);
    }
    var conv = ac.createConvolver(); conv.buffer = ir;
    var dark = ac.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 1500;
    room = ac.createGain(); room.gain.value = 0.3;
    room.connect(dark); dark.connect(conv); conv.connect(comp);
    return ac;
  }
  function ready() {
    if (!soundOn) return null;
    var ctx = audio(); if (!ctx) return null;
    if (ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    return ctx;
  }
  function bus(node, wet) {   /* salida directa más un envío al eco */
    node.connect(out);
    if (wet) { var s = ac.createGain(); s.gain.value = wet; node.connect(s); s.connect(room); }
  }
  function filter(type, freq, q, gain) {
    var f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    if (gain != null) f.gain.value = gain;
    return f;
  }
  /* Ruido de fricción: grave, con tirones irregulares (pega y suelta) */
  function dragBuffer(seconds) {
    var sr = ac.sampleRate, n = Math.floor(sr * seconds);
    var b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    var brown = 0, rough = 0.7, target = 0.7, next = 0, slip = 0;
    for (var i = 0; i < n; i++) {
      var r = Math.random() * 2 - 1;
      brown = (brown + 0.05 * r) / 1.05;
      if (i >= next) {
        target = 0.3 + Math.random() * 0.7;
        next = i + Math.floor(sr * (0.01 + Math.random() * 0.035));
        if (Math.random() < 0.1) slip = 1;
      }
      rough += (target - rough) * 0.003;
      slip *= 0.9992;
      d[i] = (brown * 3.4 + r * 0.05) * rough * (1 + slip * 1.6);
    }
    return b;
  }
  /* Un golpe que hace resonar placas de acero: ruido corto por filtros muy cerrados */
  function strike(t, level, modes, wet) {
    var src = ac.createBufferSource(); src.buffer = white;
    var g = ac.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(g);
    modes.forEach(function (m) {
      var f = filter('bandpass', m[0], m[1]);
      var mg = ac.createGain(); mg.gain.value = m[2];
      g.connect(f); f.connect(mg); bus(mg, wet);
    });
    src.start(t, Math.random()); src.stop(t + 0.05);
  }
  /* Golpe sordo: ruido grave con caída */
  function thump(t, level, freq, decay, wet) {
    var src = ac.createBufferSource(); src.buffer = white;
    var f = filter('lowpass', freq, 1.2);
    var f2 = filter('lowpass', freq * 1.5, 0.7);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f); f.connect(f2); f2.connect(g); bus(g, wet);
    src.start(t, Math.random()); src.stop(t + decay + 0.05);
  }
  /* Las hojas pesadas arrastrándose por el riel */
  function dragSound(delay, seconds, closing) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay, dur = seconds;
    var src = ctx.createBufferSource(); src.buffer = dragBuffer(dur + 0.3);
    var low = filter('lowpass', closing ? 420 : 700, 0.7);
    low.frequency.setValueAtTime(closing ? 420 : 700, t);
    low.frequency.linearRampToValueAtTime(closing ? 700 : 380, t + dur);
    var body = filter('peaking', 120, 1.1, 9);    /* peso */
    var grit = filter('peaking', 420, 2, 4);      /* roce de metal */
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    if (closing) {
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
      g.gain.linearRampToValueAtTime(1, t + dur * 0.92);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    } else {
      g.gain.exponentialRampToValueAtTime(1, t + 0.1);
      g.gain.linearRampToValueAtTime(0.55, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    }
    var lv = ctx.createGain(); lv.gain.value = closing ? 0.32 : 0.24;
    src.connect(low); low.connect(body); body.connect(grit); grit.connect(g); g.connect(lv); bus(lv, 0.22);
    src.start(t); src.stop(t + dur + 0.3);
  }
  var SLAM = [[86, 60, 14], [131, 70, 11], [197, 80, 8], [289, 90, 6], [433, 100, 4], [641, 110, 2.5]];
  var BOLT = [[260, 50, 6], [415, 60, 5], [690, 70, 3.5], [1030, 80, 2]];
  /* Las dos hojas de acero chocan */
  function slamSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    thump(t, 14, 110, 0.6, 0.35);    /* cuerpo */
    thump(t, 2.2, 900, 0.08, 0.3);   /* el filo del impacto */
    strike(t, 5, SLAM, 0.5);         /* el acero resuena */
  }
  /* El broche se traba: ka-chunk */
  function clunk(t, level) {
    thump(t, 6 * level, 180, 0.2, 0.3);
    thump(t, 1.6 * level, 1400, 0.03, 0.3);
    strike(t, 4 * level, BOLT, 0.4);
  }
  function lockSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    clunk(t + 0.12, 0.6);
    clunk(t + 0.2, 1);
  }
  function unlockSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    clunk(t, 0.9);
    clunk(t + 0.09, 0.55);
  }
  function closeSounds() {
    dragSound(0, CLOSE_MS / 1000, true);
    slamSound(CLOSE_MS / 1000 - 0.012);
    lockSound(CLOSE_MS / 1000 + 0.02);
  }
  function openSounds() {
    unlockSound(0);
    dragSound(UNLATCH_MS / 1000 - 0.03, OPEN_MS / 1000, false);
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
    return Promise.all([play(seals[0], unlatch, UNLATCH_MS, 'ease-in'), play(seals[1], unlatch, UNLATCH_MS, 'ease-in')])
      .then(function (sealAnims) {
        lastAnims = sealAnims;
        var ease = 'cubic-bezier(.5, 0, .25, 1)';   /* arranca lento: pesa */
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
