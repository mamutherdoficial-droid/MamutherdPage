/* Se carga antes de pintar: marca la página como animable para ocultar
   lo que GSAP va a revelar. Si GSAP no llega en 3 s, se muestra todo. */
(function () {
  var root = document.documentElement;
  root.classList.add('anim');
  /* Si se llegó cruzando la puerta desde otra página, la página nueva
     empieza tapada y travel.js abre la puerta. */
  try {
    if (window.sessionStorage.getItem('mamut-puerta') === '1') root.classList.add('door-arrive');
  } catch (e) { /* sin almacenamiento: no hay puerta al llegar */ }
  window.setTimeout(function () { root.classList.remove('door-arrive'); }, 4000);
  window.setTimeout(function () {
    if (!root.classList.contains('anim-ready')) root.classList.remove('anim');
  }, 3000);
})();
