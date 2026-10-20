/* PhoneYa2 lightweight performance guard. Avoid scroll listeners that trigger repeated style recalculation. */
(function(){
  'use strict';
  if(window.__py2PerformanceGuardLoaded)return;
  window.__py2PerformanceGuardLoaded=true;
  // Deliberately no scroll handler: native touch scrolling should remain fully in browser control.
})();
