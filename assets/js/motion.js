/* Mamut Herd — animaciones con GSAP + ScrollTrigger + SplitText.

   Dos modos:
   - Completo: los mamuts caminan (patas, cuerpo, trompa y cola), la historia del
     invierno avanza con el scroll, los textos entran y salen.
   - Calmado (cuando la persona pidió reducir el movimiento en su sistema): solo
     fundidos suaves de los textos; los mamuts quedan quietos y nada se fija. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('anim'); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);
  var hasSplit = !!window.SplitText;
  if (hasSplit) gsap.registerPlugin(SplitText);

  var $ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var one = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var EASE = 'power3.out';
  var INOUT = 'play reverse play reverse';

  /* ================= Caminar =================
     Ciclo de paso con andar diagonal: la pata trasera cercana se mueve con la
     delantera lejana, y al revés. Un ciclo dura T segundos.
     En T/4 + n·T/2 todas las patas están rectas: ese es el "quieto". */
  var T = 1;
  var REST = T / 4;
  function walkCycle(svg, opts) {
    opts = opts || {};
    var A = opts.swing || 15;
    var tl = gsap.timeline({ paused: true, repeat: -1 });
    [['.leg-nb', A], ['.leg-ff', A], ['.leg-nf', -A], ['.leg-fb', -A]].forEach(function (pair) {
      var el = one(pair[0], svg); if (!el) return;
      var o = el.getAttribute('data-o');
      tl.fromTo(el, { rotation: -pair[1], svgOrigin: o }, { rotation: pair[1], svgOrigin: o, duration: T / 2, ease: 'sine.inOut', repeat: 1, yoyo: true }, 0);
    });
    tl.fromTo(one('.w-top', svg), { y: 0 }, { y: -4, duration: T / 4, ease: 'sine.inOut', repeat: 3, yoyo: true }, 0);
    tl.fromTo(one('.w-trunk', svg), { rotation: -4, svgOrigin: '224 108' }, { rotation: 5, svgOrigin: '224 108', duration: T / 2, ease: 'sine.inOut', repeat: 1, yoyo: true }, 0);
    tl.fromTo(one('.w-tail', svg), { rotation: -9, svgOrigin: '52 118' }, { rotation: 9, svgOrigin: '52 118', duration: T / 2, ease: 'sine.inOut', repeat: 1, yoyo: true }, 0);
    tl.totalTime(REST);
    return tl;
  }
  /* Termina el paso en curso y se queda quieto. */
  function settle(walk, dur) {
    var t = walk.totalTime();
    var target = REST + Math.ceil((t - REST) / (T / 2)) * (T / 2);
    walk.pause();
    return gsap.to(walk, { totalTime: target, duration: dur || 0.35, ease: 'power1.out' });
  }
  /* Parpadeo y oreja de vez en cuando, mientras esté en pantalla. */
  function lifeSigns(svg) {
    var eye = one('.w-eye', svg), ear = one('.w-ear', svg);
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 2.6, delay: 2 });
    tl.to(eye, { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.07, yoyo: true, repeat: 1 })
      .to(ear, { rotation: -12, svgOrigin: '190 62', duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '+=1.6')
      .to(eye, { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.07, yoyo: true, repeat: 1 }, '+=1.2');
    return tl;
  }
  /* Recorrido: anima la posición y mueve las patas al mismo ritmo. */
  function stroll(tl, box, walk, at, dur, fromX, steps) {
    var proxy = { t: REST };
    tl.fromTo(box, { x: fromX }, { x: 0, duration: dur, ease: 'none' }, at);
    tl.fromTo(proxy, { t: REST }, { t: REST + steps * (T / 2), duration: dur, ease: 'none', onUpdate: function () { walk.totalTime(proxy.t); } }, at);
  }

  /* ================= Textos ================= */
  function revealTitle(el, opts, calm) {
    if (!el) return;
    opts = opts || {};
    var trigger = opts.immediate ? null : { trigger: el, start: 'top 88%', end: 'bottom 6%', toggleActions: INOUT };
    if (calm || !hasSplit) {
      return gsap.from(el, { autoAlpha: 0, y: calm ? 0 : 40, duration: calm ? 0.9 : 0.9, ease: EASE, delay: opts.delay || 0, scrollTrigger: trigger });
    }
    gsap.set(el, { autoAlpha: 1 });
    SplitText.create(el, {
      type: 'lines,words', mask: 'lines', autoSplit: true,
      onSplit: function (self) {
        return gsap.from(self.lines, { yPercent: 110, autoAlpha: 0, duration: 1, ease: 'power4.out', stagger: 0.09, delay: opts.delay || 0, scrollTrigger: trigger });
      }
    });
  }
  function fadeUp(targets, trigger, extra, calm) {
    if (!targets || targets.length === 0) return;
    var base = { autoAlpha: 0, y: calm ? 0 : 34, duration: 0.8, ease: EASE, stagger: 0.1,
      scrollTrigger: { trigger: trigger, start: 'top 85%', end: 'bottom 8%', toggleActions: INOUT } };
    if (calm) { extra = extra ? Object.assign({}, extra, { x: 0, y: 0, scale: 1 }) : null; }
    return gsap.from(targets, Object.assign(base, extra || {}));
  }
  function drawRule(el, calm) {
    if (!el || calm) return;
    return gsap.from(el, { scaleX: 0, transformOrigin: '0 50%', duration: 1.1, ease: 'power2.inOut',
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: INOUT } });
  }

  /* ================= Nieve ================= */
  function makeSnow(canvas) {
    var ctx = canvas.getContext('2d'), flakes = [], w = 0, h = 0, dpr = 1, running = false, raf = 0;
    var state = { intensity: 1 };
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.max(60, Math.min(220, w * h / 6500)));
      flakes = [];
      for (var i = 0; i < n; i++) flakes.push({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.4, v: 18 + Math.random() * 42, d: Math.random() * Math.PI * 2, k: Math.random() });
    }
    var last = 0;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#EEF3F6';
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        if (f.k > state.intensity) continue;
        f.d += dt * 0.8;
        f.y += f.v * dt * (0.6 + state.intensity * 0.6);
        f.x += Math.sin(f.d) * 14 * dt - 10 * dt * state.intensity;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x < -4) f.x = w + 4;
        ctx.globalAlpha = 0.35 + f.r / 5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    return {
      state: state,
      play: function () { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
      pause: function () { running = false; cancelAnimationFrame(raf); }
    };
  }

  var mm = gsap.matchMedia();
  mm.add({ full: '(prefers-reduced-motion: no-preference)', calm: '(prefers-reduced-motion: reduce)' }, function (ctx) {
    var calm = ctx.conditions.calm;

    /* Encabezado: se esconde al bajar y vuelve al subir. */
    var top = one('.top');
    if (top && !calm) {
      gsap.from(top, { yPercent: -100, autoAlpha: 0, duration: 0.7, ease: EASE });
      var shown = true;
      ScrollTrigger.create({
        start: 120, end: 'max',
        onUpdate: function (self) {
          var show = self.direction < 0 || !!one('.menu-btn[aria-expanded="true"]');
          if (show !== shown) { shown = show; gsap.to(top, { yPercent: show ? 0 : -100, duration: 0.35, ease: 'power2.out', overwrite: true }); }
        },
        onLeaveBack: function () { shown = true; gsap.to(top, { yPercent: 0, duration: 0.3, overwrite: true }); }
      });
    }

    /* ---------- Inicio: el mamut llega caminando y saluda ---------- */
    var hero = one('.hero');
    if (hero) {
      revealTitle(one('.hero__title', hero), { immediate: true, delay: 0.15 }, calm);
      gsap.from(one('.hero__lead', hero), { autoAlpha: 0, y: calm ? 0 : 26, duration: 0.9, ease: EASE, delay: 0.55 });
      gsap.from($('.hero .btn'), { autoAlpha: 0, y: calm ? 0 : 20, duration: 0.7, ease: EASE, stagger: 0.1, delay: 0.75 });

      var hw = one('.hero__walker', hero);
      if (hw && !calm) {
        var hwalk = walkCycle(hw);
        var arrive = gsap.timeline({ delay: 0.2 });
        var startX = function () { return -(hw.getBoundingClientRect().right + 40); };
        gsap.set(hw, { x: startX() });
        arrive.add(function () { hwalk.timeScale(1.15).play(); }, 0)
          .to(hw, { x: 0, duration: 3, ease: 'power1.out' }, 0)
          .to(hwalk, { timeScale: 0.35, duration: 0.9, ease: 'power1.in' }, 2.1)
          .add(function () { settle(hwalk, 0.4); }, 3)
          /* saluda con la trompa */
          .to(one('.w-trunk', hw), { rotation: -30, svgOrigin: '224 108', duration: 0.45, ease: 'power2.out' }, 3.45)
          .to(one('.w-trunk', hw), { rotation: 0, svgOrigin: '224 108', duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 3.95);
        lifeSigns(hw);
        gsap.from(one('.peaks--hero', hero), { yPercent: 40, autoAlpha: 0, duration: 1.6, ease: EASE, delay: 0.2 });

        /* Al bajar, se va caminando a la derecha; si subes, regresa. */
        var proxyHero = { p: 0 };
        ScrollTrigger.create({
          trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4,
          onUpdate: function (self) {
            if (self.progress > 0.001 && arrive.isActive()) arrive.progress(1);
            if (arrive.progress() < 1) return;
            hwalk.pause();
            hwalk.totalTime(REST + self.progress * 6 * T);
            gsap.set(hw, { x: self.progress * window.innerWidth * 0.75 });
          }
        });
        gsap.to([one('.hero__title', hero), one('.hero__text', hero)], {
          autoAlpha: 0, y: -70, ease: 'none', stagger: 0.05,
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 30%', scrub: 0.6 }
        });
      }
    }

    /* ---------- El invierno: la cría sola, luego llega la manada ---------- */
    var winter = one('.winter');
    if (winter) {
      var a = one('.winter__a', winter), b = one('.winter__b', winter);
      if (calm) {
        revealTitle(a, {}, true); revealTitle(b, {}, true);
      } else {
        winter.classList.add('is-story');
        var snow = makeSnow(one('.winter__snow', winter));
        var boxes = { calf: one('.winter__walker--calf', winter), a: one('.winter__walker--a', winter), b: one('.winter__walker--b', winter) };
        var walks = { calf: walkCycle(one('svg', boxes.calf), { swing: 17 }), a: walkCycle(one('svg', boxes.a)), b: walkCycle(one('svg', boxes.b)) };
        var off = function (box) { return function () { return -(box.offsetLeft + box.offsetWidth + 60); }; };
        var glow = one('.winter__glow', winter);
        gsap.set(glow, { opacity: 0 });
        gsap.set(b, { autoAlpha: 0 });

        revealTitle(a, {}, false);
        var story = gsap.timeline({ defaults: { ease: 'none' } });
        stroll(story, boxes.calf, walks.calf, 0, 3.6, off(boxes.calf), 14);
        story.to(a, { autoAlpha: 0, y: -40, duration: 0.6, ease: 'power2.in' }, 3.4)
             .to(b, { autoAlpha: 1, duration: 0.01 }, 4)
             .from(b, { y: 50, duration: 0.8, ease: EASE }, 4);
        stroll(story, boxes.a, walks.a, 3.8, 3.6, off(boxes.a), 10);
        stroll(story, boxes.b, walks.b, 4.2, 3.8, off(boxes.b), 12);
        story.to(snow.state, { intensity: 0.18, duration: 3.5 }, 4.6)
             .to(glow, { opacity: 1, duration: 3.5 }, 4.6)
             .to(one('.peaks--far', winter), { xPercent: -4, duration: 10 }, 0)
             .to(one('.peaks--near', winter), { xPercent: -9, duration: 10 }, 0)
             /* la cría saluda a la manada */
             .to(one('.w-trunk', boxes.calf), { rotation: -26, svgOrigin: '224 108', duration: 0.5, ease: 'power2.out' }, 8)
             .to(one('.w-trunk', boxes.calf), { rotation: 0, svgOrigin: '224 108', duration: 0.9, ease: 'power2.inOut' }, 8.6)
             .to({}, { duration: 0.6 }, 9.5);

        ScrollTrigger.create({
          trigger: winter, start: 'top top', end: '+=280%', pin: true, scrub: 0.8,
          animation: story, invalidateOnRefresh: true,
          onToggle: function (self) { if (self.isActive) snow.play(); }
        });
        ScrollTrigger.create({
          trigger: winter, start: 'top bottom', end: 'bottom top',
          onToggle: function (self) { if (self.isActive) snow.play(); else snow.pause(); }
        });
        lifeSigns(one('svg', boxes.calf));
      }
    }

    /* Qué hacemos */
    var about = one('.about');
    if (about) {
      revealTitle(one('.about__title', about), {}, calm);
      $('.about__cols > div', about).forEach(function (col) {
        fadeUp([one('h3', col), one('p', col)], col, null, calm);
      });
    }

    /* Productos: las tarjetas entran en tanda; la foto de Antesala se acerca al aparecer */
    var products = one('.products');
    if (products) {
      revealTitle(one('h2', products), {}, calm);
      fadeUp(one('.products__head p', products), products, null, calm);
      fadeUp($('.pcard', products), one('.pgrid', products), { y: calm ? 0 : 50, stagger: 0.12 }, calm);
    }

    /* Preguntas frecuentes */
    var faq = one('.faq');
    if (faq) {
      revealTitle(one('h2', faq), {}, calm);
      fadeUp($('.faq details', faq), one('.faq__list', faq), { y: calm ? 0 : 20, stagger: 0.07 }, calm);
    }

    /* De cría a mamut: los tres caminan juntos al ritmo del scroll */
    var grow = one('.grow');
    if (grow) {
      gsap.from(one('h2', grow), { autoAlpha: 0, y: calm ? 0 : 40, duration: 0.9, ease: EASE,
        scrollTrigger: { trigger: grow, start: 'top 70%', toggleActions: INOUT } });
      if (!grow.classList.contains('is-scrolly')) {
        fadeUp($('.level', grow), one('.levels', grow), null, calm);
      } else if (!calm) {
        var herd = one('.grow__herd', grow), scene = one('.grow__scene', grow);
        var members = $('.grow__member', grow).map(function (m, i) {
          return { walk: walkCycle(one('svg', m), { swing: [18, 16, 14][i] }), steps: [30, 22, 16][i] };
        });
        ScrollTrigger.create({
          trigger: grow, start: 'top top', end: 'bottom bottom', scrub: 0.5,
          onUpdate: function (self) {
            var p = self.progress;
            members.forEach(function (m) { m.walk.totalTime(REST + p * m.steps * (T / 2)); });
            gsap.set(herd, { x: p * Math.max(0, scene.clientWidth - herd.offsetWidth) });
          }
        });
        $('.grow__member svg', grow).forEach(lifeSigns);
      }
    }

    /* Lo que recibe un asociado: el sello rueda hasta su lugar */
    var gets = one('.gets');
    if (gets) {
      revealTitle(one('h2', gets), {}, calm);
      gsap.from(one('.seal', gets), calm
        ? { autoAlpha: 0, duration: 0.9, scrollTrigger: { trigger: one('.seal', gets), start: 'top 92%', toggleActions: INOUT } }
        : { autoAlpha: 0, scale: 0.4, rotation: -200, duration: 1.2, ease: 'back.out(1.4)', scrollTrigger: { trigger: one('.seal', gets), start: 'top 92%', toggleActions: INOUT } });
      $('.gets__list > div', gets).forEach(function (item) {
        fadeUp([one('dt', item), one('dd', item)], item, { x: 0 }, calm);
      });
    }

    /* Unirse: la manada avanza por el borde */
    var join = one('.join');
    if (join) {
      revealTitle(one('h2', join), {}, calm);
      fadeUp(one('.join__lead', join), one('.join__lead', join), null, calm);
      fadeUp($('.join .btn'), one('.join .actions'), { y: 20 }, calm);
      drawRule(one('.steps', join), calm);
      fadeUp($('.steps li', join), one('.steps', join), { x: 40, y: 0, stagger: 0.14 }, calm);

      var parade = one('.parade', join);
      if (parade && !calm) {
        var track = one('.parade__track', parade);
        var pw = $('.parade__m svg', parade).map(function (svg, i) {
          var w = walkCycle(svg, { swing: [18, 16, 14][i] });
          w.timeScale([1.5, 1.2, 1][i]);
          return w;
        });
        var march = gsap.fromTo(track, { x: function () { return -track.offsetWidth - 20; } },
          { x: function () { return parade.clientWidth + 20; }, duration: function () { return (parade.clientWidth + track.offsetWidth) / 70; }, ease: 'none', repeat: -1, paused: true });
        ScrollTrigger.create({
          trigger: parade, start: 'top bottom', end: 'bottom top', invalidateOnRefresh: true,
          onToggle: function (self) {
            if (self.isActive) { march.play(); pw.forEach(function (w) { w.play(); }); }
            else { march.pause(); pw.forEach(function (w) { w.pause(); }); }
          }
        });
      }
    }

    /* Pie: el mamut llega caminando */
    var foot = one('.foot');
    if (foot) {
      var fw = one('.foot__walker', foot);
      if (fw && !calm) {
        var fwalk = walkCycle(fw);
        ScrollTrigger.create({
          trigger: foot, start: 'top 85%', once: true,
          onEnter: function () {
            gsap.fromTo(fw, { x: -260 }, { x: 0, duration: 2.2, ease: 'power1.out',
              onStart: function () { fwalk.play(); },
              onComplete: function () { settle(fwalk, 0.4); } });
          }
        });
        gsap.set(fw, { x: -260 });
        lifeSigns(fw);
      }
      fadeUp($('.foot__name, .foot__tag, .foot__nav a, .foot__contact a', foot), foot, { y: 18, stagger: 0.05 }, calm);
    }

    /* ---------- Marca ---------- */
    var head = one('.page-head');
    if (head) {
      revealTitle(one('h1', head), { immediate: true, delay: 0.15 }, calm);
      gsap.from($('.page-head p, .page-head .btn'), { autoAlpha: 0, y: calm ? 0 : 24, duration: 0.8, ease: EASE, stagger: 0.12, delay: 0.5 });
      $('.kit__block').forEach(function (block) {
        revealTitle(one('h2', block), {}, calm);
        fadeUp(one(':scope > p', block), block, { delay: 0.1 }, calm);
        var items = $('.tile, .swatch, .type, .film', block);
        if (items.length) {
          var dy = calm ? 0 : 40;
          gsap.set(items, { autoAlpha: 0, y: dy });
          ScrollTrigger.batch(items, {
            start: 'top 92%', end: 'bottom 4%',
            onEnter: function (bt) { gsap.to(bt, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.1, overwrite: true }); },
            onLeave: function (bt) { gsap.to(bt, { autoAlpha: 0, y: -dy * 0.75, duration: 0.5, ease: 'power2.in', stagger: 0.05, overwrite: true }); },
            onEnterBack: function (bt) { gsap.to(bt, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.1, overwrite: true }); },
            onLeaveBack: function (bt) { gsap.to(bt, { autoAlpha: 0, y: dy, duration: 0.5, ease: 'power2.in', overwrite: true }); }
          });
        }
        var rules = one('.rules', block);
        if (rules) { drawRule(rules, calm); fadeUp($('li', rules), rules, { y: 16, stagger: 0.07 }, calm); }
      });
    }

    /* ---------- 404 ---------- */
    var lost = one('.lost');
    if (lost) {
      revealTitle(one('h1', lost), { immediate: true, delay: 0.15 }, calm);
      gsap.from($('.lost p, .lost .btn'), { autoAlpha: 0, y: calm ? 0 : 24, duration: 0.8, ease: EASE, stagger: 0.12, delay: 0.5 });
      if (!calm) gsap.from(one('.lost__mamut', lost), { x: 260, autoAlpha: 0, duration: 1.6, ease: 'power2.out', delay: 0.3 });
    }

    root.classList.add('anim-ready');
    return function () { root.classList.remove('anim-ready'); };
  });

  if (!root.classList.contains('anim-ready')) root.classList.remove('anim');
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
