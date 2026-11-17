/* Mamut Herd — viaje entre secciones.
   Al tocar un enlace interno: suena un viento suave y la página se desenfoca
   un poco mientras se desplaza. El viento se crea en el navegador (Web Audio),
   no hay archivos de sonido. El botón de sonido del encabezado lo silencia y
   la elección se recuerda en este navegador. */
(function () {
  'use strict';
  var KEY = 'mamut-sonido';
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

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
      if (soundOn) whoosh(0.6);
    });
  }

  /* ---------- Viento ---------- */
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
  function whoosh(seconds) {
    if (!soundOn) return;
    var ctx = audio(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime, dur = Math.max(0.6, Math.min(1.6, seconds || 1));
    var src = ctx.createBufferSource(); src.buffer = noise;
    var band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 0.9;
    band.frequency.setValueAtTime(320, t);
    band.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.45);
    band.frequency.exponentialRampToValueAtTime(380, t + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = gain;
    if (ctx.createStereoPanner) {
      var pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t + dur);
      gain.connect(pan); out = pan;
    }
    src.connect(band); band.connect(gain); out.connect(ctx.destination);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  /* ---------- Desenfoque ----------
     Se usa un velo fijo con backdrop-filter en vez de desenfocar <main>:
     un filtro en <main> rompería las escenas que se quedan fijas al bajar. */
  var veil = document.createElement('div');
  veil.className = 'travel-veil';
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  function setBlur(px) { return { '--vb': px + 'px' }; }
  function blurPulse(seconds) {
    if (calm.matches || !window.gsap) return;
    var dur = seconds || 1;
    gsap.timeline()
      .set(veil, { autoAlpha: 1 })
      .fromTo(veil, setBlur(0), Object.assign(setBlur(7), { duration: dur * 0.35, ease: 'power2.in' }))
      .to(veil, Object.assign(setBlur(0), { duration: dur * 0.65, ease: 'power2.out' }))
      .set(veil, { autoAlpha: 0 });
  }

  /* ---------- Enlaces ---------- */
  var here = window.location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  function samePage(url) {
    var p = url.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
    return url.origin === window.location.origin && p === here;
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
      var y = target.getBoundingClientRect().top + window.scrollY;
      var dist = Math.abs(y - window.scrollY);
      var dur = Math.max(0.8, Math.min(1.6, dist / 2600));
      whoosh(dur + 0.2);
      if (calm.matches || !window.gsap || !window.ScrollToPlugin) {
        target.scrollIntoView();
      } else {
        blurPulse(dur);
        gsap.to(window, { scrollTo: { y: target, offsetY: 0, autoKill: true }, duration: dur, ease: 'power3.inOut' });
      }
      if (history.pushState) history.pushState(null, '', url.hash);
      target.setAttribute('tabindex', '-1');
      window.setTimeout(function () { target.focus({ preventScroll: true }); }, dur * 1000);
      return;
    }

    if (!samePage(url)) {           /* otra página del sitio: viento y fundido antes de salir */
      e.preventDefault();
      whoosh(0.9);
      if (calm.matches || !window.gsap) { window.location.href = url.href; return; }
      gsap.timeline({ onComplete: function () { window.location.href = url.href; } })
        .set(veil, { autoAlpha: 1 })
        .fromTo(veil, Object.assign(setBlur(0), { backgroundColor: 'rgba(238, 243, 246, 0)' }),
          Object.assign(setBlur(10), { backgroundColor: 'rgba(238, 243, 246, 1)', duration: 0.45, ease: 'power2.in' }));
    }
  });

  /* Al volver con el botón "atrás" del navegador, la página no debe quedar borrosa. */
  window.addEventListener('pageshow', function () {
    if (window.gsap) gsap.set(veil, Object.assign(setBlur(0), { autoAlpha: 0, backgroundColor: 'rgba(238, 243, 246, 0)' }));
  });

  /* Al llegar desde otra página: un desenfoque que se aclara. */
  if (!calm.matches && window.gsap && document.referrer && document.referrer.indexOf(window.location.origin) === 0) {
    gsap.timeline()
      .set(veil, Object.assign(setBlur(10), { autoAlpha: 1, backgroundColor: 'rgba(238, 243, 246, 1)' }))
      .to(veil, Object.assign(setBlur(0), { backgroundColor: 'rgba(238, 243, 246, 0)', duration: 0.7, ease: 'power2.out' }))
      .set(veil, { autoAlpha: 0 });
  }
})();
