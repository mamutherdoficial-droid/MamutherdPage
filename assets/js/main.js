/* Mamut Herd — comportamiento del sitio. Sin dependencias. */
(function () {
  'use strict';

  /* Menú en celular */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    var setOpen = function (open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    };
    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });
  }

  /* De cría a mamut: el mamut crece con el scroll.
     Solo se activa si la persona no pidió reducir el movimiento y la pantalla tiene alto suficiente. */
  var grow = document.querySelector('.grow');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (grow && !calm.matches && window.innerHeight >= 520 && window.CSS && CSS.supports('opacity', 'clamp(0, 1, 1)')) {
    var levels = grow.querySelectorAll('.level');
    var members = grow.querySelectorAll('.grow__member');
    var current = -1;
    var ticking = false;
    grow.classList.add('is-scrolly');

    var update = function () {
      ticking = false;
      var rect = grow.getBoundingClientRect();
      var travel = rect.height - window.innerHeight;
      var p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 1;
      grow.style.setProperty('--p', p.toFixed(4));
      var idx = p < 0.3 ? 0 : p < 0.66 ? 1 : 2;
      if (idx !== current) {
        current = idx;
        levels.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
        members.forEach(function (el, i) { el.classList.toggle('is-on', i === idx); });
      }
    };
    var request = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* Página de marca: copiar el código de un color */
  document.querySelectorAll('.swatch[data-hex]').forEach(function (sw) {
    var hint = sw.querySelector('.swatch__hint');
    var idle = hint ? hint.textContent : '';
    sw.addEventListener('click', function () {
      var hex = sw.getAttribute('data-hex');
      var done = function (ok) {
        if (!hint) return;
        hint.textContent = ok ? 'Copiado' : 'Cópialo a mano: ' + hex;
        window.setTimeout(function () { hint.textContent = idle; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  /* Imágenes externas (Higgsfield): si no cargan, se quitan y queda el fondo de diseño. */
  document.querySelectorAll('img.ext-img').forEach(function (img) {
    var drop = function () { img.remove(); };
    if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener('error', drop);
  });

  /* Menú: resalta la sección que se está viendo. */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { var id = a.getAttribute('href').slice(1); if (id) byId[id] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = byId[e.target.id]; if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-current'); l.removeAttribute('aria-current'); });
          a.classList.add('is-current'); a.setAttribute('aria-current', 'location');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }
})();
