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
  var CLOSE_MS = 480, LATCH_MS = 300, UNLATCH_MS = 220, HOLD_MS = 140, OPEN_MS = 640;
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

  /* ---------- Sonidos: puerta de bóveda ----------
     Hojas de acero que ruedan por su riel, un golpe con cuerpo y eco de
     cámara, la rueda del broche con su trinquete y tres pernos que se
     traban. Al abrir, los pernos se sueltan y la junta deja escapar aire. */
  var ac = null, noise = null, white = null, out = null, room = null;
  function audio() {
    if (ac) return ac;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    var len = Math.floor(ac.sampleRate * 2);
    noise = ac.createBuffer(1, len, ac.sampleRate);   /* ruido "café": grave, para el peso */
    white = ac.createBuffer(1, len, ac.sampleRate);   /* ruido blanco: para el aire de la junta */
    var d = noise.getChannelData(0), w = white.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02;
      d[i] = last * 3.2;
    }
    /* Todo pasa por un compresor para que el golpe pese sin saturar */
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5;
    comp.attack.value = 0.002; comp.release.value = 0.3;
    comp.connect(ac.destination);
    out = ac.createGain(); out.gain.value = 0.9; out.connect(comp);
    /* Eco de una cámara grande de concreto y metal */
    var rlen = Math.floor(ac.sampleRate * 1.6), ir = ac.createBuffer(2, rlen, ac.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c);
      for (var j = 0; j < rlen; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / rlen, 3.2);
    }
    var conv = ac.createConvolver(); conv.buffer = ir;
    var dark = ac.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 2400;
    room = ac.createGain(); room.gain.value = 0.32;
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
  function env(param, t, peak, attack, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function hit(t, o) {        /* ráfaga corta de ruido filtrado */
    var a = o.attack || 0.003;
    var src = ac.createBufferSource(); src.buffer = o.white ? white : noise;
    var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q || 1;
    var g = ac.createGain(); env(g.gain, t, o.peak, a, o.decay);
    src.connect(f); f.connect(g); bus(g, o.wet);
    src.start(t, Math.random()); src.stop(t + a + o.decay + 0.05);
  }
  function tone(t, o) {       /* tono con caída de afinación opcional */
    var a = o.attack || 0.004;
    var osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + a + o.decay);
    var g = ac.createGain(); env(g.gain, t, o.peak, a, o.decay);
    osc.connect(g); bus(g, o.wet);
    osc.start(t); osc.stop(t + a + o.decay + 0.05);
  }
  /* Las hojas pesadas rodando sobre su riel */
  function slideSound(delay, seconds, closing) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay, dur = seconds;
    var src = ctx.createBufferSource(); src.buffer = noise;
    var low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.Q.value = 0.9;
    low.frequency.setValueAtTime(closing ? 110 : 260, t);
    low.frequency.exponentialRampToValueAtTime(closing ? 260 : 100, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(closing ? 0.9 : 0.75, t + dur * (closing ? 0.9 : 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (closing ? 0.02 : 0.25));
    src.connect(low); low.connect(g); bus(g, 0.15);
    src.start(t, Math.random() * 0.7); src.stop(t + dur + 0.3);
    /* Rodamientos: un chirrido grave de metal que tiembla */
    var src2 = ctx.createBufferSource(); src2.buffer = noise;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(closing ? 300 : 380, t);
    bp.frequency.exponentialRampToValueAtTime(closing ? 380 : 290, t + dur);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.5);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    var trem = ctx.createGain(); trem.gain.value = 0.6;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    var depth = ctx.createGain(); depth.gain.value = 0.4;
    lfo.connect(depth); depth.connect(trem.gain);
    src2.connect(bp); bp.connect(g2); g2.connect(trem); bus(trem, 0.2);
    src2.start(t, Math.random() * 0.7); src2.stop(t + dur + 0.1);
    lfo.start(t); lfo.stop(t + dur + 0.1);
  }
  /* Las dos hojas de acero se encuentran */
  function slamSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    tone(t, { from: 72, to: 30, peak: 1, attack: 0.004, decay: 0.9, wet: 0.25 });            /* retumbo */
    hit(t, { type: 'lowpass', freq: 320, peak: 1, attack: 0.002, decay: 0.22, wet: 0.4 });     /* golpe */
    hit(t, { freq: 1300, q: 0.8, peak: 0.3, attack: 0.001, decay: 0.05, wet: 0.5 });            /* filo */
    [[112, 0.05, 1.3], [171, 0.04, 1], [247, 0.035, 0.8], [389, 0.022, 0.6], [563, 0.014, 0.45], [811, 0.008, 0.3]]
      .forEach(function (p) { tone(t + 0.002, { from: p[0], peak: p[1], attack: 0.003, decay: p[2], wet: 0.6 }); }); /* el acero resuena */
  }
  /* La rueda del broche gira con su trinquete y tres pernos se traban */
  function lockSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    for (var i = 0; i < 4; i++) hit(t + i * 0.04, { freq: 2300 + i * 90, q: 7, peak: 0.12, attack: 0.001, decay: 0.025, wet: 0.3 });
    [0, 0.06, 0.12].forEach(function (off, k) {
      var b = t + 0.17 + off;
      tone(b, { from: 150 - k * 12, to: 70, peak: 0.55, attack: 0.002, decay: 0.16, wet: 0.35 });
      hit(b, { freq: 950, q: 1.4, peak: 0.4, attack: 0.001, decay: 0.07, wet: 0.4 });
      tone(b + 0.004, { type: 'triangle', from: 1480 + k * 60, peak: 0.025, attack: 0.002, decay: 0.18, wet: 0.5 });
    });
  }
  /* Los pernos se sueltan y la junta deja escapar el aire */
  function unlockSound(delay) {
    var ctx = ready(); if (!ctx) return;
    var t = ctx.currentTime + delay;
    [0, 0.055, 0.11].forEach(function (off, k) {
      var b = t + off;
      tone(b, { from: 125 + k * 10, to: 85, peak: 0.4, attack: 0.002, decay: 0.12, wet: 0.35 });
      hit(b, { freq: 820, q: 1.2, peak: 0.28, attack: 0.001, decay: 0.06, wet: 0.4 });
    });
    hit(t + 0.17, { white: true, type: 'highpass', freq: 2500, q: 0.7, peak: 0.07, attack: 0.02, decay: 0.38, wet: 0.2 });
  }
  function closeSounds() {
    slideSound(0, CLOSE_MS / 1000, true);
    slamSound(CLOSE_MS / 1000 - 0.012);
    lockSound(CLOSE_MS / 1000 + 0.02);
  }
  function openSounds() {
    unlockSound(0);
    slideSound(UNLATCH_MS / 1000 - 0.02, OPEN_MS / 1000, false);
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
