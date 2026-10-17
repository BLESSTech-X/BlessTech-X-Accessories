/* PhoneYa2 Living Water Experience v4 — ripples stay behind solid floating content. */
(function () {
  'use strict';
  if (window.__py2WaterExperienceV4) return;
  window.__py2WaterExperienceV3 = true;

  var root = document.documentElement, body = document.body;
  if (!body) return;
  root.classList.add('py2-water-enabled');
  body.classList.add('py2-water-page');

  if (!document.querySelector('link[data-py2-water-styles]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/water-experience.css?v=20261017-living-water4';
    link.setAttribute('data-py2-water-styles', 'true');
    document.head.appendChild(link);
  }

  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var lowPower = saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  var background = document.createElement('canvas');
  background.id = 'py2-water-surface';
  background.setAttribute('aria-hidden', 'true');
  var foreground = document.createElement('canvas');
  foreground.id = 'py2-water-interaction-surface';
  foreground.setAttribute('aria-hidden', 'true');
  body.insertBefore(background, body.firstChild);
  body.appendChild(foreground);
  var bg = background.getContext('2d', { alpha: false, desynchronized: true });
  var fg = foreground.getContext('2d', { alpha: true, desynchronized: true });
  if (!bg || !fg) return;

  var w = 1, h = 1, dpr = 1, frame = 0, lastFrame = 0, elapsed = 0;
  var ripples = [], lastScrollY = window.scrollY || 0, lastScrollAt = 0, lastPointerAt = 0;
  var running = !reducedMotion && !document.hidden;
  var logo = new Image();
  logo.src = 'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg';
  var logoReady = false;
  logo.onload = function () { logoReady = true; };
  logo.onerror = function () { logoReady = false; };

  function resize() {
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
    [background, foreground].forEach(function (canvas) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    });
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    fg.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWater();
    drawRipples();
  }

  function drawSubmergedLogo() {
    if (!logoReady || !logo.naturalWidth || w < 10) return;
    var maxW = Math.min(w * .43, 430);
    var ratio = Math.min(maxW / logo.naturalWidth, Math.min(h * .36, 310) / logo.naturalHeight);
    var dw = logo.naturalWidth * ratio, dh = logo.naturalHeight * ratio;
    var left = (w - dw) / 2, top = h * .53 - dh / 2;
    bg.save();
    bg.globalAlpha = .17;
    bg.globalCompositeOperation = 'multiply';
    /* Draw narrow horizontal slices with tiny phase-shifted offsets: the mark appears beneath moving water. */
    var slices = lowPower ? 28 : 54;
    var sh = logo.naturalHeight / slices, destH = dh / slices;
    for (var i = 0; i < slices; i++) {
      var phase = elapsed * 1.15 + i * .27;
      var offset = Math.sin(phase) * (lowPower ? 2.2 : 4.5) + Math.sin(phase * .57) * 1.7;
      bg.drawImage(logo, 0, i * sh, logo.naturalWidth, sh + 1, left + offset, top + i * destH, dw, destH + 1);
    }
    bg.restore();
  }

  function drawWater() {
    if (!bg || !w || !h) return;
    var t = elapsed;
    bg.clearRect(0, 0, w, h);
    var base = bg.createLinearGradient(0, 0, w * .8, h);
    base.addColorStop(0, '#087c9b');
    base.addColorStop(.28, '#119bb5');
    base.addColorStop(.57, '#087f9f');
    base.addColorStop(1, '#043d61');
    bg.fillStyle = base;
    bg.fillRect(0, 0, w, h);

    var glow = bg.createRadialGradient(w * (.22 + Math.sin(t * .34) * .06), h * .12, 0, w * .32, h * .16, Math.max(w, h) * .8);
    glow.addColorStop(0, 'rgba(190,250,255,.30)');
    glow.addColorStop(.28, 'rgba(87,221,235,.15)');
    glow.addColorStop(.7, 'rgba(20,139,180,.045)');
    glow.addColorStop(1, 'rgba(0,34,66,.22)');
    bg.fillStyle = glow;
    bg.fillRect(0, 0, w, h);

    /* Sun caustics: moving, broken ribbons instead of flat parallel lines. */
    bg.save();
    bg.globalCompositeOperation = 'screen';
    var bands = lowPower ? 9 : 16;
    var step = lowPower ? 27 : 17;
    for (var band = 0; band < bands; band++) {
      var yBase = h * (.055 + band * (.89 / bands));
      bg.beginPath();
      for (var x = -step; x <= w + step; x += step) {
        var wave = Math.sin(x * .009 + t * 1.65 + band * .72) * (4 + band % 4) +
          Math.sin(x * .021 - t * 1.13 + band * 1.7) * 2.7 +
          Math.sin(x * .004 + t * .72) * 4;
        var y = yBase + wave;
        if (x === -step) bg.moveTo(x, y); else bg.lineTo(x, y);
      }
      bg.strokeStyle = 'rgba(215,252,255,' + (.035 + (band % 5) * .009) + ')';
      bg.lineWidth = band % 3 === 0 ? 1.5 : .75;
      bg.stroke();
    }
    /* Scattered caustic glints add depth and give the water a real light path. */
    var glints = lowPower ? 18 : 38;
    for (var g = 0; g < glints; g++) {
      var gx = (g * 137.5 + Math.sin(t + g) * 34) % (w + 30) - 15;
      var gy = (g * 83.7 + Math.cos(t * .8 + g * 1.4) * 25) % (h + 20) - 10;
      bg.beginPath();
      bg.ellipse(gx, gy, 5 + (g % 5) * 2.4, 1 + (g % 3) * .6, Math.sin(t + g) * .35, 0, Math.PI * 2);
      bg.fillStyle = 'rgba(224,253,255,' + (.025 + (g % 4) * .012) + ')';
      bg.fill();
    }
    bg.restore();
    drawSubmergedLogo();
    /* Soft vignette creates underwater depth at the edges. */
    var shade = bg.createRadialGradient(w * .5, h * .44, Math.min(w, h) * .12, w * .5, h * .5, Math.max(w, h) * .78);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,24,48,.24)');
    bg.fillStyle = shade;
    bg.fillRect(0, 0, w, h);
  }

  function addRipple(x, y, strength, splash) {
    if (reducedMotion || document.hidden || ripples.length > 4) return;
    var droplets = [];
    if (splash) {
      var count = lowPower ? 3 : 4;
      for (var d = 0; d < count; d++) {
        droplets.push({
          angle: Math.PI * 2 * d / count + Math.random() * .32,
          distance: 6 + Math.random() * 9,
          size: .8 + Math.random() * 1.1,
          lift: 5 + Math.random() * 9
        });
      }
    }
    ripples.push({
      x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)),
      max: Math.min(94, 38 + (strength || 0) * 24),
      born: performance.now(), duration: splash ? 950 : 1100,
      strength: Math.min(1.7, strength || 1), droplets: droplets
    });
    if (!running) start();
  }

  function drawRipples() {
    if (!fg) return;
    fg.clearRect(0, 0, w, h);
    var now = performance.now();
    for (var i = ripples.length - 1; i >= 0; i--) {
      var r = ripples[i], progress = (now - r.born) / r.duration;
      if (progress >= 1) { ripples.splice(i, 1); continue; }
      var ease = 1 - Math.pow(1 - progress, 2);
      var radius = 4 + ease * r.max;
      var alpha = Math.pow(1 - progress, 1.35) * (.22 + r.strength * .06);
      fg.save();
      fg.globalCompositeOperation = 'screen';
      /* Several uneven rings mimic surface tension and refracted highlights. */
      for (var ring = 0; ring < 2; ring++) {
        var wobble = 1 + Math.sin(elapsed * 3 + ring * 1.8) * .025;
        fg.beginPath();
        fg.ellipse(r.x, r.y, radius * (1 + ring * .19) * wobble, radius * (.52 + ring * .105), Math.sin(elapsed + ring) * .045, 0, Math.PI * 2);
        fg.strokeStyle = 'rgba(223,253,255,' + (alpha * (1 - ring * .19)) + ')';
        fg.lineWidth = ring === 0 ? 1.7 : 1;
        fg.stroke();
      }
      /* A soft specular flash at the point of impact. */
      var flash = fg.createRadialGradient(r.x, r.y, 0, r.x, r.y, 24 + progress * 20);
      flash.addColorStop(0, 'rgba(237,255,255,' + (alpha * .28) + ')');
      flash.addColorStop(1, 'rgba(237,255,255,0)');
      fg.fillStyle = flash;
      fg.beginPath(); fg.arc(r.x, r.y, 44, 0, Math.PI * 2); fg.fill();
      r.droplets.forEach(function (drop) {
        var travel = ease * (drop.distance + 25);
        var dx = r.x + Math.cos(drop.angle) * travel;
        var dy = r.y + Math.sin(drop.angle) * travel - Math.sin(progress * Math.PI) * drop.lift;
        var opacity = Math.max(0, 1 - progress * 1.8) * .65;
        fg.beginPath();
        fg.ellipse(dx, dy, drop.size * (1 - progress * .48), drop.size * 1.65 * (1 - progress * .48), drop.angle, 0, Math.PI * 2);
        fg.fillStyle = 'rgba(239,255,255,' + opacity + ')';
        fg.fill();
        fg.beginPath();
        fg.arc(dx - drop.size * .25, dy - drop.size * .35, Math.max(.4, drop.size * .25), 0, Math.PI * 2);
        fg.fillStyle = 'rgba(255,255,255,' + (opacity * .8) + ')';
        fg.fill();
      });
      fg.restore();
    }
  }

  function tick(now) {
    if (!running) { frame = 0; return; }
    var delta = Math.min(50, now - (lastFrame || now));
    if (now - lastFrame > (lowPower ? 42 : 26)) {
      elapsed += delta * .001;
      drawWater();
      drawRipples();
      lastFrame = now;
    }
    frame = window.requestAnimationFrame(tick);
  }
  function start() {
    if (running || reducedMotion || document.hidden) return;
    running = true;
    lastFrame = 0;
    frame = window.requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else { drawWater(); drawRipples(); start(); }
  });
  window.addEventListener('scroll', function () {
    var now = performance.now(), y = window.scrollY || 0;
    var movement = Math.abs(y - lastScrollY);
    if (movement > 24 && now - lastScrollAt > 260) {
      var impactX = w * (.14 + Math.random() * .72);
      var impactY = Math.max(95, Math.min(h - 35, h * (.25 + Math.random() * .52)));
      addRipple(impactX, impactY, Math.min(.8, .3 + movement / 180), false);
      lastScrollAt = now;
    }
    lastScrollY = y;
  }, { passive: true });

  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var now = performance.now();
    if (now - lastPointerAt < 260) return;
    lastPointerAt = now;
    var target = event.target;
    if (target && target.closest && target.closest('button, a, [role="button"], input, select, .pcard, .pc, .pcard-img, .product-card')) {
      /* Put the impact just outside a solid surface so the ring appears in surrounding water. */
      var surface = target.closest('.pcard, .product-card, .section-card, .panel, .benefit, .contact-card, .about-card, .policy-card, .checkout-card, .order-summary, .howto-mini-inner, button, a, [role="button"]');
      var x = event.clientX, y = event.clientY;
      if (surface && surface.getBoundingClientRect) {
        var rect = surface.getBoundingClientRect();
        var edgePoints = [
          { d: Math.abs(event.clientX - rect.left), x: rect.left - 8, y: Math.max(rect.top + 8, Math.min(rect.bottom - 8, event.clientY)) },
          { d: Math.abs(rect.right - event.clientX), x: rect.right + 8, y: Math.max(rect.top + 8, Math.min(rect.bottom - 8, event.clientY)) },
          { d: Math.abs(event.clientY - rect.top), x: Math.max(rect.left + 8, Math.min(rect.right - 8, event.clientX)), y: rect.top - 8 },
          { d: Math.abs(rect.bottom - event.clientY), x: Math.max(rect.left + 8, Math.min(rect.right - 8, event.clientX)), y: rect.bottom + 8 }
        ];
        edgePoints.sort(function(a,b){return a.d-b.d;});
        x=edgePoints[0].x; y=edgePoints[0].y;
        if (x < 8 || x > w-8 || y < 8 || y > h-8) { x=event.clientX; y=event.clientY; }
      }
      addRipple(x, y, .75, false);
    }
  }, { passive: true });

  resize();
  if (running) frame = window.requestAnimationFrame(tick);
  else { drawWater(); drawRipples(); }
  window.addEventListener('pageshow', start);
})();