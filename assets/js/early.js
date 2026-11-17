/* Se carga antes de pintar: marca la página como animable para ocultar
   lo que GSAP va a revelar. Si GSAP no llega en 3 s, se muestra todo. */
(function () {
  var root = document.documentElement;
  root.classList.add('anim');
  window.setTimeout(function () {
    if (!root.classList.contains('anim-ready')) root.classList.remove('anim');
  }, 3000);
})();
