/* PhoneYa2 Living Water Experience — lightweight, decorative, and safe to ignore */
(function () {
  'use strict';
  if (window.__py2WaterExperienceLoaded) return;
  window.__py2WaterExperienceLoaded = true;

  var root = document.documentElement;
  var body = document.body;
  if (!body || body.classList.contains('py2-water-page')) return;
  root.classList.add('py2-water-enabled');
  body.classList.add('py2-water-page');

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var canvas = document.createElement('canvas');
  canvas.id = 'py2-water-surface';
  canvas.setAttribute('aria-hidden', 'true');
  body.insertBefore(canvas, body.firstChild);
  var ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  var w = 0, h = 0, dpr = 1, frame = 0, lastFrame = 0, t = 0;
  var ripples = [];
  var running = !reducedMotion && !saveData && !document.hidden;
  var pointerCooldown = 0;
  var lastScrollAt = 0;
  var lastScrollY = window.scrollY || 0;

  function resize() {
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(0);
  }

  function addRipple(x, y, strength) {
    if (reducedMotion || saveData || ripples.length > 5) return;
    ripples.push({ x: x, y: y, radius: 4, max: 55 + (strength || 0) * 15, alpha: .38, speed: 1.2, born: performance.now() });
    if (!running && !document.hidden) start();
  }

  function draw(delta) {
    if (!ctx || !w || !h) return;
    t += delta * .00012;
    ctx.clearRect(0, 0, w, h);

    /* Layered teal/blue light gives the page a continuous water-like depth. */
    var base = ctx.createLinearGradient(0, 0, w * .9, h);
    base.addColorStop(0, 'rgba(7, 100, 133, .94)');
    base.addColorStop(.38, 'rgba(14, 151, 177, .91)');
    base.addColorStop(.72, 'rgba(7, 104, 143, .93)');
    base.addColorStop(1, 'rgba(4, 63, 96, .96)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * (.22 + Math.sin(t) * .035), h * .18, 0, w * .3, h * .2, Math.max(w, h) * .72);
    glow.addColorStop(0, 'rgba(143, 239, 247, .21)');
    glow.addColorStop(.48, 'rgba(64, 201, 220, .075)');
    glow.addColorStop(1, 'rgba(0, 44, 79, .13)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    /* Fine moving caustic ribbons mimic sunlight refracting through shallow water. */
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var band = 0; band < 12; band++) {
      var yBase = h * (.09 + band * .078);
      ctx.beginPath();
      for (var x = -24; x <= w + 24; x += 18) {
        var y = yBase + Math.sin(x * .010 + t * 3.3 + band * .7) * (5 + band % 3) +
          Math.sin(x * .021 - t * 2.1 + band) * 2.6;
        if (x === -24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(188, 247, 255,' + (.018 + (band % 4) * .006) + ')';
      ctx.lineWidth = 1 + (band % 3) * .25;
      ctx.stroke();
    }
    ctx.restore();

    var now = performance.now();
    for (var i = ripples.length - 1; i >= 0; i--) {
      var r = ripples[i];
      var age = now - r.born;
      var progress = age / 1050;
      if (progress >= 1) { ripples.splice(i, 1); continue; }
      var radius = 4 + progress * r.max;
      var alpha = (1 - progress) * .34;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (var ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, radius * (1 + ring * .26), radius * (.42 + ring * .09), Math.sin(t + ring) * .08, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(218, 252, 255,' + (alpha * (1 - ring * .23)) + ')';
        ctx.lineWidth = ring === 0 ? 1.4 : .8;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function tick(now) {
    if (!running) { frame = 0; return; }
    if (now - lastFrame > 30) {
      draw(Math.min(50, now - (lastFrame || now)));
      lastFrame = now;
    }
    frame = window.requestAnimationFrame(tick);
  }
  function start() {
    if (running || reducedMotion || saveData || document.hidden) return;
    running = true;
    lastFrame = 0;
    frame = window.requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    draw(0);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener('scroll', function () {
    var now = performance.now();
    var y = window.scrollY || 0;
    var movement = Math.abs(y - lastScrollY);
    if (movement > 16 && now - lastScrollAt > 150) {
      addRipple(w * (.18 + Math.random() * .64), Math.max(90, Math.min(h - 60, h * (.28 + Math.random() * .46))), Math.min(2, movement / 120));
      lastScrollAt = now;
    }
    lastScrollY = y;
  }, { passive: true });

  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var now = performance.now();
    if (now - pointerCooldown < 220) return;
    pointerCooldown = now;
    var target = event.target;
    if (target && target.closest && target.closest('button, a, [role="button"], input[type="submit"]')) {
      addRipple(event.clientX, event.clientY, 1);
    }
  }, { passive: true });

  resize();
  if (running) frame = window.requestAnimationFrame(tick);
  else draw(0);
  window.addEventListener('pageshow', start);
})();
