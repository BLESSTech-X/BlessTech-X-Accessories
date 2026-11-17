/* Backward compatibility for cached pages that still request the legacy seasonal script. */
(function () {
  'use strict';
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src') || '';
    if (src.indexOf('/seasonal-experience.js') !== -1) return;
  }
  if (window.__phoneya2SeasonalCompatibilityLoading) return;
  window.__phoneya2SeasonalCompatibilityLoading = true;
  var script = document.createElement('script');
  script.src = '/seasonal-experience.js?v=20261108-auto-calendar3';
  script.defer = true;
  document.head.appendChild(script);
})();
