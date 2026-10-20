/* Tiny passive scroll coordinator: pauses decorative CSS animation while the user scrolls. */
(function(){
  'use strict';
  if(window.__py2PerformanceScrollCoordinator)return;
  window.__py2PerformanceScrollCoordinator=true;
  var root=document.documentElement,timer=0,raf=0;
  function onScroll(){
    if(!root.classList.contains('py2-is-scrolling'))root.classList.add('py2-is-scrolling');
    if(timer)clearTimeout(timer);
    timer=setTimeout(function(){root.classList.remove('py2-is-scrolling');timer=0},170);
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('pagehide',function(){if(timer)clearTimeout(timer);if(raf)cancelAnimationFrame(raf);root.classList.remove('py2-is-scrolling')},{passive:true});
})();
