// Versión sin Three.js — Canvas 2D
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, window.devicePixelRatio || 1);

// ========== TEST MODE OVERRIDE (default OFF) ==========
// Set to true to test locally: it will make the countdown target today at the hour/minute below
const TEST_MODE = false; // set to true to enable local testing
const TEST_TARGET_HOUR = 23; // hour (24h) to test
const TEST_TARGET_MINUTE = 10; // minute to test
// =========================================

// Parámetros del árbol
let PARTICLE_COUNT = 1300; // fijo
const LED_COUNT = 20; // luces LED fijas
const TREE_HEIGHT = 6; // unidades arbitrarias
const MAX_RADIUS = 3.2;
let bloomStrength = 0.45; // fijo (sin control UI)

// Cámara / proyección
let rotationY = 0; // rotación actual
let targetRotation = 0; // para arrastrar
let cameraFocal = 6; // distancia focal para proyección
const scaleFactor = 110; // escala en pixeles por unidad
// rotación automática suave (rad/s)
let autoRotateSpeed = 0.18; // ajustable (pequeño = más lenta) 

let particles = [];
let lights = [];
let lastTime = performance.now();

function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function rand(a = 0, b = 1) { return a + Math.random() * (b - a) }

function generateParticles(count) {
    particles = new Array(count);
    for (let i = 0; i < count; i++) {
        // sesgo para densidad en la base
        const t = Math.pow(Math.random(), 0.6); // 0..1 => altura
        const y = t * TREE_HEIGHT;
        const rBase = (1 - (y / TREE_HEIGHT));
        const r = rBase * MAX_RADIUS * (0.6 + Math.random() * 0.8);
        const theta = Math.random() * Math.PI * 2;
        // jitter simétrico pequeño (disminuye hacia la punta) para mantener la forma cónica
        const jitterMag = 0.08 * (1 - (y / TREE_HEIGHT));
        const jitter = (Math.random() - 0.5) * jitterMag;
        const x = Math.cos(theta) * r + jitter * Math.cos(theta);
        const z = Math.sin(theta) * r + jitter * Math.sin(theta);

        const baseColor = {
            r: 10 + Math.random() * 40,
            g: 140 + Math.random() * 120,
            b: 40 + Math.random() * 40
        };

        let baseBrightness = 0.15 + Math.random() * 0.6; // reducido por defecto
        let size = 2 + Math.random() * 3;

        const phase = Math.random() * Math.PI * 2;

        particles[i] = { x, y, z, theta, baseColor, baseBrightness, phase, size };
    }
}

function generateLights(count) {
    lights = new Array(count);
    const palette = [
        { r: 255, g: 80, b: 60 },
        { r: 255, g: 210, b: 80 },
        { r: 80, g: 150, b: 255 }
    ];
    for (let i = 0; i < count; i++) {
        const t = Math.random();
        const y = t * TREE_HEIGHT;
        const rBase = (1 - (y / TREE_HEIGHT));
        const r = rBase * MAX_RADIUS * (0.5 + Math.random() * 0.8);
        const theta = Math.random() * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 0.06;
        const x = Math.cos(theta) * r + jitter * Math.cos(theta);
        const z = Math.sin(theta) * r + jitter * Math.sin(theta);
        const color = palette[Math.floor(Math.random() * palette.length)];
        const brightness = 0.9 + Math.random() * 0.6;
        const phase = Math.random() * Math.PI * 2;
        const size = 2 + Math.random() * 1.2;
        lights[i] = { x, y, z, color, brightness, phase, size };
    }
}

generateParticles(PARTICLE_COUNT);
// generar LEDs fijos en el árbol
generateLights(LED_COUNT);

// util: proyección simple con perspectiva en Z
function project(px, py, pz, rotY) {
    // rotación alrededor de Y
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const rx = px * c - pz * s;
    const rz = px * s + pz * c;
    // perspectiva
    const focal = cameraFocal;
    const scale = focal / (focal + rz + 2.0); // +2 para desplazar hacia delante
    const sx = (canvas.width / DPR) / 2 + rx * scale * scaleFactor;
    const sy = (canvas.height / DPR) / 2 - (py - TREE_HEIGHT / 2) * scale * scaleFactor;
    return { sx, sy, scale, rz };
}

function drawParticle(p, t) {
    const proj = project(p.x, p.y, p.z, rotationY);
    if (proj.scale <= 0) return;

    // hojas (comportamiento por defecto)
    const brightness = p.baseBrightness * (0.45 + 0.5 * Math.abs(Math.sin(t * 3 + p.phase)));
    const size = Math.max(0.8, p.size * proj.scale * 6);
    const r = p.baseColor.r, g = p.baseColor.g, b = p.baseColor.b;
    const alpha = Math.min(1, brightness * bloomStrength * 0.85);

    const grd = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, size);
    grd.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grd.addColorStop(0.2, `rgba(${r},${g},${b},${alpha * 0.55})`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, size, 0, Math.PI * 2);
    ctx.fill();

    // draw subtle core to show form para hojas
    ctx.globalAlpha = Math.min(1, 0.6 * alpha + 0.2);
    ctx.fillStyle = `rgba(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)},1)`;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, Math.max(0.8, size * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'source-over';
}

function drawLight(l, t) {
    const proj = project(l.x, l.y, l.z, rotationY);
    if (proj.scale <= 0) return;

    // core should be a fixed solid color dot; glow is a blurred shadow behind
    const baseSize = Math.max(0.6, l.size * proj.scale * 5);
    const r = l.color.r, g = l.color.g, b = l.color.b;

    // blurred glow (shadow) behind the point
    const blurPx = Math.max(2, baseSize * 1.8);
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28; // glow strength
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, baseSize * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // solid core (fixed, full color)
    ctx.beginPath();
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.arc(proj.sx, proj.sy, Math.max(0.9, baseSize * 0.45), 0, Math.PI * 2);
    ctx.fill();

    // subtle rim/shadow for depth (very faint)
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(proj.sx + Math.max(0.5, baseSize * 0.12), proj.sy + Math.max(0.5, baseSize * 0.12), Math.max(0.95, baseSize * 0.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawStar(t) {
    // position at top y = TREE_HEIGHT
    const p = { x: 0, y: TREE_HEIGHT + 0.6, z: 0 };
    const proj = project(p.x, p.y, p.z, rotationY);
    if (proj.scale <= 0) return;

    // adaptive sizes (smaller on narrow screens)
    const isNarrow = window.innerWidth < 560;
    const baseHalo = isNarrow ? 26 : 40;
    const baseCore = isNarrow ? 10 : 16;

    // pulse factor for gentle blink
    const pulse = 0.85 + 0.25 * Math.abs(Math.sin(t * 2.6));

    const haloRadius = baseHalo * (0.9 + 0.15 * Math.sin(t * 1.6));
    const haloAlpha = 0.55 * pulse;

    // halo gradient
    const grd = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, haloRadius);
    grd.addColorStop(0, `rgba(255,244,180,${haloAlpha})`);
    grd.addColorStop(0.25, `rgba(255,200,80,${Math.min(0.5, haloAlpha * 0.65)})`);
    grd.addColorStop(1, `rgba(255,160,50,0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, haloRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // star core (pulsing size)
    const r = baseCore * (0.9 + 0.18 * Math.abs(Math.sin(t * 3.0)));
    const coreAlpha = 0.98;
    ctx.fillStyle = `rgba(255,245,200,${coreAlpha})`;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = i * (Math.PI * 2) / 5 - Math.PI / 2;
        const x = proj.sx + Math.cos(a) * r;
        const y = proj.sy + Math.sin(a) * r;
        const a2 = a + Math.PI / 5;
        const x2 = proj.sx + Math.cos(a2) * r * 0.45;
        const y2 = proj.sy + Math.sin(a2) * r * 0.45;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    // outer small sparkle
    ctx.save();
    ctx.globalAlpha = 0.5 * pulse;
    ctx.fillStyle = `rgba(255,250,210,0.35)`;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy - r * 0.6, Math.max(1.2, r * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => { if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; targetRotation += dx * 0.006; } });

// UI removed: particle & bloom sliders were removed from the HTML (fixed values are used)

function animate(now) {
    const deltaMs = Math.max(0, now - lastTime);
    const dt = deltaMs / 1000;
    // auto-rotate hacia target (si no se está arrastrando)
    if (!dragging) targetRotation += autoRotateSpeed * dt;
    // suaviza rotación hacia target
    rotationY += (targetRotation - rotationY) * Math.min(0.25, 5 * dt);

    // clear
    ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);

    // Depth sort by rz
    const t = now * 0.001;
    const sorted = particles.slice().sort((a, b) => (b.z * Math.cos(rotationY) + b.x * Math.sin(rotationY)) - (a.z * Math.cos(rotationY) + a.x * Math.sin(rotationY)));

    // draw filled silhouette for the cone (avoids a central stroke line)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4,40,18,0.14)';
    ctx.beginPath();
    // top point
    const top = project(0, TREE_HEIGHT, 0, rotationY);
    ctx.moveTo(top.sx, top.sy);
    const steps = 40;
    // right edge from top to base
    for (let s = 0; s <= steps; s++) {
        const pct = s / steps;
        const y = pct * TREE_HEIGHT;
        const rUnits = (1 - (y / TREE_HEIGHT)) * MAX_RADIUS * 0.9;
        const p = project(rUnits, y, 0, rotationY);
        ctx.lineTo(p.sx, p.sy);
    }
    // left edge back to top
    for (let s = steps; s >= 0; s--) {
        const pct = s / steps;
        const y = pct * TREE_HEIGHT;
        const rUnits = (1 - (y / TREE_HEIGHT)) * MAX_RADIUS * 0.9;
        const p = project(-rUnits, y, 0, rotationY);
        ctx.lineTo(p.sx, p.sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw leaves first (all particles are leaves now)
    const leaves = sorted;
    for (let p of leaves) drawParticle(p, t);

    // Draw fixed LEDs on top
    const lightsSorted = lights.slice().sort((a, b) => ((b.z * Math.cos(rotationY) + b.x * Math.sin(rotationY)) - (a.z * Math.cos(rotationY) + a.x * Math.sin(rotationY))));
    for (let l of lightsSorted) drawLight(l, t);

    drawStar(t);

  // ensure snow particles exist when enabled (keep them falling infinitely)
  if (snowEnabled && !snowParticles.length) initSnow();
  // update and draw snow (subtle overlay)
  updateSnow(dt);
  drawSnow(dt);

    lastTime = now;
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Initial hint
console.log('Árbol Canvas listo. Rotación automática y 10 LEDs fijos.');

// ===== Celebration / Confetti (now on separate overlay canvas) =====
let confetti = [];
let celebrationLaunched = false;
const confettiColors = ['#ff4d4f', '#ffd86b', '#7cc3ff', '#ff9ad6', '#98ffb3', '#ffd2a3'];

// confetti overlay canvas and context
let confCanvas = null;
let confCtx = null;

// celebration control
let celebrationTimeout = null;
let prevFocused = null;
function initConfettiCanvas() {
    confCanvas = document.getElementById('confetti-canvas');
    if (!confCanvas) return;
    confCtx = confCanvas.getContext('2d');
    resizeConfettiCanvas();
}

function resizeConfettiCanvas() {
    if (!confCanvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    confCanvas.width = Math.floor(w * DPR);
    confCanvas.height = Math.floor(h * DPR);
    confCanvas.style.width = w + 'px';
    confCanvas.style.height = h + 'px';
    if (confCtx) confCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

window.addEventListener('resize', () => { resizeConfettiCanvas(); });

// initialize confetti canvas after DOM variables are available
initConfettiCanvas();

// initialize snow overlay canvas
let snowCanvas = null;
let snowCtx = null;
function initSnowCanvas(){
  snowCanvas = document.getElementById('snow-canvas');
  if (!snowCanvas) return;
  snowCtx = snowCanvas.getContext('2d');
  resizeSnowCanvas();
}

function resizeSnowCanvas(){
  if (!snowCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  snowCanvas.width = Math.floor(w * DPR);
  snowCanvas.height = Math.floor(h * DPR);
  snowCanvas.style.width = w + 'px';
  snowCanvas.style.height = h + 'px';
  if (snowCtx) snowCtx.setTransform(DPR,0,0,DPR,0,0);
}

window.addEventListener('resize', ()=>{ resizeSnowCanvas(); });
initSnowCanvas();

// ===== Snow particles (subtle UI effect) =====
let snowParticles = [];
let SNOW_COUNT = 140;
let snowEnabled = localStorage.getItem('snowEnabled') !== 'false'; // default true

function initSnow(count=SNOW_COUNT){
  // spawn all snow starting above the top so they fall into the scene
  snowParticles = new Array(count).fill(0).map(()=>createSnowParticle(false));
}

function createSnowParticle(startOnScreen=false){
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.random()*w,
    // start above the visible area so particles fall from top to bottom
    y: startOnScreen ? Math.random()*h : - (Math.random()* (Math.min(h, 120) ) + 8),
    r: 1 + Math.random()*3.2,
    speed: 30 + Math.random()*60, // px/s (vertical speed)
    drift: (Math.random()-0.5) * 10, // gentle horizontal drift
    sway: Math.random()*0.6 + 0.2,
    phase: Math.random()*Math.PI*2,
    alpha: 0.6 + Math.random()*0.35
  };
}

function setSnowEnabled(v){ snowEnabled = !!v; localStorage.setItem('snowEnabled', v ? 'true':'false'); const b = document.getElementById('snow-toggle'); if(b) b.setAttribute('aria-pressed', v ? 'true':'false'); }
function toggleSnow(){ setSnowEnabled(!snowEnabled); if(snowEnabled && !snowParticles.length) initSnow(); }

function updateSnow(dt){
  if(!snowEnabled || !snowParticles.length) return;
  const w = window.innerWidth; const h = window.innerHeight;
  for(let p of snowParticles){
    p.y += p.speed * dt; // fall primarily vertically
    p.x += p.drift * dt + Math.sin((performance.now()/1000)*p.sway + p.phase) * (p.drift * 0.12 * dt);
    if(p.y - p.r > h){ // recycle above
      p.x = Math.random()*w;
      p.y = - (Math.random() * 40 + 8);
      p.r = 1 + Math.random()*3.2;
      p.speed = 30 + Math.random()*60;
      p.alpha = 0.6 + Math.random()*0.35;
    }
  }
}

function drawSnow(dt){
  if(!snowEnabled || !snowParticles.length || !snowCtx) return;
  // clear snow canvas each frame
  snowCtx.clearRect(0,0,snowCanvas.width/DPR, snowCanvas.height/DPR);
  snowCtx.save();
  for(let p of snowParticles){
    snowCtx.beginPath();
    snowCtx.fillStyle = `rgba(255,255,255,${p.alpha})`;
    snowCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    snowCtx.fill();
  }
  snowCtx.restore();
}

// initialize snow if enabled
if (snowEnabled) initSnow();

// bind snow toggle button
(function bindSnowToggle(){ const s = document.getElementById('snow-toggle'); if (!s) return; s.setAttribute('aria-pressed', snowEnabled ? 'true':'false'); s.addEventListener('click', (e)=>{ e.preventDefault(); toggleSnow(); }); })();



function spawnConfetti(amount = 120, originX = null, originY = null) {
    // originX/Y are CSS pixels relative to confCanvas top-left
    const canvasW = confCanvas ? confCanvas.width / DPR : window.innerWidth;
    const canvasH = confCanvas ? confCanvas.height / DPR : window.innerHeight;
    confetti = confetti.concat(Array.from({ length: amount }).map(() => {
        const baseX = originX !== null ? originX : (canvasW * (0.25 + Math.random() * 0.5));
        const baseY = originY !== null ? originY : (canvasH * (0.08 + Math.random() * 0.12));
        const x = baseX + (Math.random() - 0.5) * 40;
        const y = baseY + (Math.random() - 0.5) * 24;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3.6;
        const vx = Math.cos(angle) * speed * 0.5 + (Math.random() - 0.5) * 1.2;
        const vy = Math.sin(angle) * speed * 0.7 + -1.8 - Math.random() * 1.2;
        const size = 6 + Math.random() * 8;
        const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        const rot = Math.random() * Math.PI * 2;
        const rotSpeed = (Math.random() - 0.5) * 0.4;
        const ttl = 4000 + Math.random() * 2000; // ms
        return { x, y, vx, vy, size, color, rot, rotSpeed, age: 0, ttl };
    }));
}

function drawConfetti(dtMs) {
    if (!confetti.length || !confCtx) return;
    // clear full overlay canvas
    confCtx.clearRect(0, 0, confCanvas.width / DPR, confCanvas.height / DPR);
    // update and draw
    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.age += dtMs;
        if (c.age > c.ttl) { confetti.splice(i, 1); continue; }
        // physics
        c.vy += 0.06; // gravity
        c.vx *= 0.995;
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.rotSpeed;
        // draw rotated rect
        confCtx.save();
        confCtx.translate(c.x, c.y);
        confCtx.rotate(c.rot);
        confCtx.fillStyle = c.color;
        confCtx.globalAlpha = 1 - (c.age / c.ttl);
        confCtx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        confCtx.restore();
    }
}

function triggerCelebration(name = '', desc = '') {
    if (celebrationLaunched) return;
    celebrationLaunched = true;
    const banner = document.getElementById('celebration-banner');
    const text = document.getElementById('celebration-text');
    const descEl = document.getElementById('celebration-desc');
    if (text) text.textContent = `¡Feliz Navidad ${name}!`;
    if (descEl) descEl.textContent = desc || 'Que pases un día maravilloso, lleno de amor y momentos dulces, que cada sonrisa de hoy te acompañe siempre. Con todo mi cariño 💖';

    // compute star projection on canvas so the banner appears above the tree (not above cards)
    const starProj = project(0, TREE_HEIGHT + 0.6, 0, rotationY);
    const rect = canvas.getBoundingClientRect();
    const pageX = rect.left + starProj.sx;
    const pageY = rect.top + starProj.sy;

    if (banner) {
        banner.setAttribute('aria-hidden', 'false');
        banner.setAttribute('aria-describedby', 'celebration-desc');
        // show as centered modal and reveal overlay backdrop
        const overlayEl = document.getElementById('overlay');
        if (overlayEl) { overlayEl.classList.add('modal-visible'); overlayEl.setAttribute('aria-hidden', 'false'); }
        banner.classList.add('show');
        // accessibility: focus the dialog
        banner.setAttribute('tabindex', '-1');
        try { banner.focus({ preventScroll: true }); } catch (e) { }
    }

    // add body class so styles can dim/hide the countdown while celebrating
    document.body.classList.add('celebration-active');

    // spawn confetti from center of the screen/modal
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    spawnConfetti(220, centerX, centerY);
    // follow-up burst
    setTimeout(() => { spawnConfetti(120, centerX, centerY - 20); }, 800);
    // schedule auto-close
    celebrationTimeout = setTimeout(() => { closeCelebrationModal(); }, 9000);
}

function closeCelebrationModal() {
    if (!celebrationLaunched) return;
    if (celebrationTimeout) { clearTimeout(celebrationTimeout); celebrationTimeout = null; }
    const banner = document.getElementById('celebration-banner');
    if (banner) { banner.classList.remove('show'); banner.setAttribute('aria-hidden', 'true'); banner.removeAttribute('tabindex'); }
    const overlayEl = document.getElementById('overlay');
    if (overlayEl) { overlayEl.classList.remove('modal-visible'); overlayEl.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('celebration-active');
    // clear confetti particles and canvas
    confetti.length = 0;
    if (confCtx && confCanvas) confCtx.clearRect(0, 0, confCanvas.width / DPR, confCanvas.height / DPR);
    // hide try button when closing
    const tryBtn = document.getElementById('try-confetti-now');
    if (tryBtn) { tryBtn.hidden = true; tryBtn.parentElement && tryBtn.parentElement.setAttribute('aria-hidden', 'true'); }
    celebrationLaunched = false;
    // restore previous focus
    if (prevFocused && typeof prevFocused.focus === 'function') { prevFocused.focus(); prevFocused = null; }
}

// Bind close button, backdrop click and Escape key
(function bindCloseHandlers() {
    const closeBtn = document.getElementById('celebration-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCelebrationModal);
    const backdrop = document.querySelector('.celebration-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeCelebrationModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && celebrationLaunched) closeCelebrationModal(); });
})();

// Bind try confetti manual button (shows after countdown reaches 0)
(function bindTryConfetti() {
    const tryBtn = document.getElementById('try-confetti-now');
    if (!tryBtn) return;
    // hidden by default; enable when countdown hits zero
    tryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        spawnConfetti(180, cx, cy);
        // small follow-up burst
        setTimeout(() => spawnConfetti(100, cx + (Math.random() - 0.5) * 60, cy - 20), 500);
    });
})();

// ===== Countdown to Christmas & greeting =====
function getNextChristmas() {
    const now = new Date();
    // Optional TEST_MODE override: return today at TEST_TARGET_HOUR:TEST_TARGET_MINUTE (or tomorrow if passed)
    if (typeof TEST_MODE !== 'undefined' && TEST_MODE) {
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TEST_TARGET_HOUR, TEST_TARGET_MINUTE, 0, 0);
        if (now > target) target.setDate(target.getDate() + 1);
        return target;
    }
    const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
    // Target: Dec 25, 00:00 local
    return new Date(year, 11, 25, 0, 0, 0);
}

function pad(n, width = 2) { return String(n).padStart(width, '0'); }

// Test button removed. To test manually, run in DevTools:
// triggerCelebration('Tu Nombre', 'Mensaje de prueba 💖');

// Bind persistent manual celebrate button (always visible)
(function bindManualButton(){
  const btn = document.getElementById('manual-celebrate');
  if (!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();

    triggerCelebration('Mi Niño(a)', 'Que pases un día maravilloso, lleno de amor y momentos dulces. Con todo mi cariño 💖');
  });
})();



function updateCountdown() {
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');
    const greetingEl = document.getElementById('greeting');
    const titleEl = document.querySelector('.greeting-title');
    const subEl = document.querySelector('.greeting-sub');
    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    const now = new Date();
    const target = getNextChristmas();
    let diff = target - now;
    if (diff <= 0) {
        // celebration state
        daysEl.textContent = '0'; hoursEl.textContent = '00'; minsEl.textContent = '00'; secsEl.textContent = '00';
        if (greetingEl && !greetingEl.classList.contains('celebrate')) {
            greetingEl.classList.add('celebrate');
            titleEl.textContent = '¡Feliz Navidad! 🎉';
            subEl.textContent = 'Que pases un día maravilloso, lleno de amor y momentos dulces, que cada sonrisa de hoy te acompañe siempre. Con todo mi cariño 💖';
        }
        // auto-launch the celebration once when the target is reached
        if (!celebrationLaunched) {
            // hide manual reveal button if present
            const tryBtn = document.getElementById('try-confetti-now');
            if (tryBtn){ tryBtn.hidden = true; tryBtn.parentElement && tryBtn.parentElement.setAttribute('aria-hidden','true'); }
            triggerCelebration('Mi Niño(a)');
        }
        return;
    }

    // compute units
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);
    const minutes = Math.floor(diff / (1000 * 60));
    diff -= minutes * (1000 * 60);
    const seconds = Math.floor(diff / 1000);

    // update DOM (with small tick animation)
    function tick(el, value) {
        if (el.textContent !== value) {
            el.classList.add('tick');
            el.textContent = value;
            setTimeout(() => el.classList.remove('tick'), 420);
        }
    }

    tick(daysEl, String(days));
    tick(hoursEl, pad(hours));
    tick(minsEl, pad(minutes));
    tick(secsEl, pad(seconds));

    if (greetingEl && greetingEl.classList.contains('celebrate')) {
        greetingEl.classList.remove('celebrate');
        titleEl.textContent = 'Falta Poco para Navidad';
        subEl.textContent = 'Espera que el contador termine hay una sorpresa especial 🎁';
    }
}

updateCountdown();
setInterval(updateCountdown, 1000);
