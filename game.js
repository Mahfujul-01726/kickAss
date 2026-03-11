// ============================================================
//  KICK YOUR BUDDY – game.js
//  Pure HTML5 Canvas game – no external libraries needed
// ============================================================

// ─── TOUCH DETECTION ───────────────────────────────────────
const isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ─── SCREEN MANAGER ─────────────────────────────────────────
const screens = {
    menu: document.getElementById('menu-screen'),
    howto: document.getElementById('howto-screen'),
    game: document.getElementById('game-screen'),
    pause: document.getElementById('pause-screen'),
    gameover: document.getElementById('gameover-screen'),
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}

// ─── CANVAS SETUP ───────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const preview = document.getElementById('preview-canvas');
const pctx = preview.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── PERSISTENCE ────────────────────────────────────────────
let highScore = parseInt(localStorage.getItem('kickHighScore') || '0');
document.getElementById('menu-high-score').textContent = highScore;
document.getElementById('high-score-display').textContent = highScore;

// ─── COLOUR PALETTE ─────────────────────────────────────────
const PALETTE = {
    sky1: '#0d1b2a', sky2: '#1a3a5c',
    ground: '#1a1a2e', groundTop: '#e94560',
    kicker: {
        skin: '#f0c090',   // warm light-tan skin
        skinShad: '#d4956a',   // shadow / deeper tone
        skinHL: '#fde8c8',   // highlight
        lip: '#c47060',
        hair: '#1c1008',
        shirt: '#cc2244',   // bright red jersey
        shirtDark: '#991133',
        pants: '#1e2d4a',   // dark navy
        pantsDark: '#131d30',
        shoe: '#111111',
        shoeSole: '#ffffff',
        lace: '#ffffff',
    },
    friend: {
        skin: '#8B5E3C',   // medium-dark brown
        skinShad: '#6e4828',   // shadow
        skinHL: '#a8764e',   // highlight
        lip: '#703828',
        hair: '#1a1008',
        kurta: '#1a4fa0',   // deep blue kurta
        kurtaHL: '#2a63c0',
        kurtaDark: '#102e70',
        kurtaDot: '#3e7be0',
        pants: '#edeae4',   // off-white pajama
        pantsShad: '#ccc8be',
        shoe: '#2c2020',
        shoeSole: '#5a3010',
        glass: '#1a1a1a',
        glassHL: '#4a4a6a',
    },
};

// ─── GAME STATE ─────────────────────────────────────────────
const GS = {
    IDLE: 'idle',       // waiting for kick
    KICKING: 'kicking', // leg-swing animation
    FLYING: 'flying',     // friend is in the air
    LANDED: 'landed',     // friend bounced, waiting
    RETURNING: 'returning',  // friend waddling back to kicker
};

let state, score, combo, maxCombo, bestHit, gameActive, animFrame;
let particles = [];
let floatingTexts = [];
let stars = [];
let screamCooldown = 0;

// ─── CHARACTER DEFINITIONS ──────────────────────────────────
function makeKicker(x, y) {
    return {
        x, y,
        kickFrame: 0,       // 0=idle, 1-5=kick swing frames
        kickCooldown: 0,
        isKicking: false,
    };
}

function makeFriend(x, y) {
    return {
        x, y,
        baseX: x,
        baseY: y,
        vx: 0, vy: 0,
        angle: 0,
        angularV: 0,
        scale: 1,
        scaleV: 0,
        bounceCount: 0,
        expression: 'normal', // normal | shocked | crying | dizzy
        flyTime: 0,
        isFlying: false,
        squash: 1,  // y scale for squash/stretch
        stretch: 1, // x scale for squash/stretch
        landed: false,
    };
}

let kicker, friend;

// ─── STARS (background) ─────────────────────────────────────
function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({
            x: Math.random() * 2000,
            y: Math.random() * 400,
            r: Math.random() * 1.5 + 0.3,
            alpha: Math.random() * 0.7 + 0.3,
        });
    }
}

// ─── GAME INIT ───────────────────────────────────────────────
function initGame() {
    score = 0; combo = 1; maxCombo = 1; bestHit = 0; gameActive = true;
    state = GS.IDLE;
    particles = []; floatingTexts = [];
    screamCooldown = 0;
    initStars();

    const ground = canvas.height * 0.72;
    kicker = makeKicker(canvas.width * 0.36, ground);
    friend = makeFriend(canvas.width * 0.36 + 100, ground);

    updateHUD();
    const hint = document.getElementById('kick-hint');
    hint.textContent = isTouchDevice()
        ? 'ট্যাপ করে লাথি মারো! 🦵'
        : 'স্পেস বা ক্লিক করে লাথি মারো! 🦵';
    hint.style.opacity = '1';
    hint.style.color = 'rgba(255,255,255,0.5)';
    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
    startGameTimer();
}

// ─── KICK ACTION ─────────────────────────────────────────────
function doKick() {
    if (!gameActive) return;
    if (state !== GS.IDLE) return;

    state = GS.KICKING;
    kicker.isKicking = true;
    kicker.kickFrame = 0;
    document.getElementById('kick-hint').style.opacity = '0';
}

// ─── PHYSICS ─────────────────────────────────────────────────
const GRAVITY = 0.55;
const GROUND_Y_RATIO = 0.72;
const BOUNCE_DAMPING = 0.5;
const BOUNCE_FRICTION = 0.82;
const MIN_BOUNCE_V = 3;

function updateFriend() {
    if (!friend.isFlying) return;

    friend.vy += GRAVITY;
    friend.x += friend.vx;
    friend.y += friend.vy;
    friend.angle += friend.angularV;
    friend.flyTime++;

    const groundY = canvas.height * GROUND_Y_RATIO;

    // Bounce on ground
    if (friend.y >= groundY) {
        friend.y = groundY;

        if (Math.abs(friend.vy) < MIN_BOUNCE_V) {
            // Settle
            friend.vy = 0; friend.vx = 0; friend.angularV = 0;
            friend.angle = 0; friend.isFlying = false;
            friend.expression = 'crying';
            friend.squash = 1; friend.stretch = 1;
            state = GS.LANDED;
            playCrySound();   // sobbing wail on final landing
            scheduleReset();
        } else {
            // Bounce
            friend.vy = -Math.abs(friend.vy) * BOUNCE_DAMPING;
            friend.vx *= BOUNCE_FRICTION;
            friend.angularV *= 0.8;
            friend.bounceCount++;

            // Squash on land
            friend.squash = 0.55;
            friend.stretch = 1.6;

            spawnBounceParticles(friend.x, groundY);
            spawnFloatingText(friend.x, groundY - 20, bounceFeedback(friend.bounceCount), '#f39c12');
        }
    }

    // Squash/stretch recovery
    friend.squash += (1 - friend.squash) * 0.18;
    friend.stretch += (1 - friend.stretch) * 0.18;

    // Score while flying
    if (friend.isFlying) {
        // Random scream
        screamCooldown--;
        if (screamCooldown <= 0) {
            screamCooldown = 40 + Math.floor(Math.random() * 30);
            const scream = FLYING_SCREAMS[Math.floor(Math.random() * FLYING_SCREAMS.length)];
            spawnFloatingText(friend.x, friend.y - 65, scream, '#ff6b6b');
            playScreamSound(scream);
        }
        score += combo;
        if (score > bestHit) bestHit = score;
        updateHUD();
    }
}

function bounceFeedback(n) {
    const msgs = ['আউচ!', 'আবার!', 'উফ!', 'আহারা!', '😂', 'আরো জোরে!'];
    return msgs[Math.min(n - 1, msgs.length - 1)] || 'ওরে বাপ!';
}

// ─── KICK ANIMATION SEQUENCE ─────────────────────────────────
const KICK_FRAMES = 7; // total frames for kick swing

function updateKicker() {
    if (!kicker.isKicking) return;
    kicker.kickFrame++;

    // At frame 4, impact!
    if (kicker.kickFrame === 4) {
        launchFriend();
        playKickSound();
        spawnImpactParticles(friend.x - 38, friend.y - 42);  // contact: shoe hits right-side butt cheeks
        shakeScreen(12, 200);
        spawnFloatingText(friend.x - 20, friend.y - 80, kickFeedback(), '#e94560');
    }

    if (kicker.kickFrame >= KICK_FRAMES) {
        kicker.isKicking = false;
        kicker.kickFrame = 0;
        state = friend.isFlying ? GS.FLYING : GS.IDLE;
    }
}

function kickFeedback() {
    const msgs = ['ধাঁই!', 'তুড়োম!', 'লাথি! 🦵', 'চাট্না!', 'গুঁড়িয়ে দে!', 'কম্বো!'];
    return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─── FLYING SCREAMS ──────────────────────────────────────────
const FLYING_SCREAMS = [
    'ওরে, আমার আর পোঁদে মারিস না।',
];

// ─── SCREAM SOUND (Web Speech API — real human TTS voice) ────
// Pre-load voices as soon as the browser is ready
if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function playScreamSound(text) {
    try {
        if (!window.speechSynthesis) return;

        // Strip emoji and punctuation that TTS can't vocalise naturally
        const spokenText = text
            .replace(/[\u{1F300}-\u{1FFFF}\u2600-\u27BF]/gu, '')
            .replace(/!+/g, '')
            .trim();
        if (!spokenText) return;

        // Cancel any queued speech so screams don't pile up
        window.speechSynthesis.cancel();

        const utt = new SpeechSynthesisUtterance(spokenText);
        utt.lang = 'bn-BD';                         // Bengali
        utt.rate = 1.4 + Math.random() * 0.6;      // 1.4–2.0× speed = panicked
        utt.pitch = 1.5 + Math.random() * 0.5;      // high pitch = scared / pain
        utt.volume = 1.0;

        // Pick the best available voice: Bengali → Hindi → default
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith('bn'))
            || voices.find(v => v.lang.startsWith('hi'))
            || null;
        if (voice) utt.voice = voice;

        window.speechSynthesis.speak(utt);
    } catch (e) { /* silent fallback */ }
}

// ─── KICK SOUND (Web Audio API) ──────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

function playKickSound() {
    try {
        const ac = getAudioCtx();
        const now = ac.currentTime;

        // — Beefy low thud (filtered noise burst) —
        const bufLen = Math.floor(ac.sampleRate * 0.22);
        const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
        }
        const noise = ac.createBufferSource();
        noise.buffer = buf;

        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;

        const gNoise = ac.createGain();
        gNoise.gain.setValueAtTime(1.4, now);
        gNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(lp); lp.connect(gNoise); gNoise.connect(ac.destination);
        noise.start(now); noise.stop(now + 0.22);

        // — Punchy mid "smack" tone —
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

        const gOsc = ac.createGain();
        gOsc.gain.setValueAtTime(0.7, now);
        gOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gOsc); gOsc.connect(ac.destination);
        osc.start(now); osc.stop(now + 0.14);
    } catch (e) { /* silence on unsupported browsers */ }
}

// ─── FAT MAN REACTION SOUNDS ─────────────────────────────────

// ── 1. KICK IMPACT: sharp "AAIYY!!" pain scream ───────────────
// ── FINAL LANDING: crying wail ──
function playCrySound() {
    try {
        const ac = getAudioCtx();
        const now = ac.currentTime;

        // Four "WAAAH" wail pulses — classic crying pattern
        const pulses = [
            { t: 0.00, p: 440 },
            { t: 0.50, p: 400 },
            { t: 1.00, p: 430 },
            { t: 1.50, p: 370 }
        ];

        pulses.forEach(({ t, p }) => {
            const o = ac.createOscillator();
            o.type = 'sawtooth';
            // rise then fall — "WAAH" shape
            o.frequency.setValueAtTime(p * 0.75, now + t);
            o.frequency.linearRampToValueAtTime(p, now + t + 0.07);  // peak
            o.frequency.linearRampToValueAtTime(p * 0.60, now + t + 0.40);  // fall off

            // mouth resonance
            const bpf = ac.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.value = 900;
            bpf.Q.value = 2.5;

            const g = ac.createGain();
            g.gain.setValueAtTime(0.0, now + t);
            g.gain.linearRampToValueAtTime(1.0, now + t + 0.04);
            g.gain.setValueAtTime(0.85, now + t + 0.14);
            g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.44);

            o.connect(bpf); bpf.connect(g); g.connect(ac.destination);
            o.start(now + t);
            o.stop(now + t + 0.46);
        });

        // Quiet breath-sob underneath the whole thing
        const hum = ac.createOscillator();
        hum.type = 'triangle';
        hum.frequency.setValueAtTime(220, now);
        hum.frequency.linearRampToValueAtTime(180, now + 2.0);
        const humG = ac.createGain();
        humG.gain.setValueAtTime(0.0, now);
        humG.gain.linearRampToValueAtTime(0.18, now + 0.1);
        humG.gain.linearRampToValueAtTime(0.14, now + 1.8);
        humG.gain.exponentialRampToValueAtTime(0.001, now + 2.05);
        hum.connect(humG); humG.connect(ac.destination);
        hum.start(now); hum.stop(now + 2.06);
    } catch (e) { }
}

function launchFriend() {
    screamCooldown = 25;  // first scream appears quickly
    const power = 14 + Math.random() * 6;
    const angle = -(Math.PI / 2.2 + Math.random() * 0.25); // ~65-75° upward (steeper)
    friend.vx = power * Math.cos(angle) * 0.55;  // much less horizontal
    friend.vy = power * Math.sin(angle) * 1.3;   // more vertical boost
    friend.angularV = (Math.random() - 0.5) * 0.35;
    friend.isFlying = true;
    friend.bounceCount = 0;
    friend.expression = 'shocked';
    friend.flyTime = 0;
    friend.landed = false;

    // Stretch on launch
    friend.squash = 1.5;
    friend.stretch = 0.6;

    // Combo increase
    combo = Math.min(combo + 1, 10);
    maxCombo = Math.max(maxCombo, combo);
    document.getElementById('combo-display').textContent = 'x' + combo;
}

// ─── RESET AFTER LANDING ─────────────────────────────────────
let resetTimer = null;
function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer);
    // Short pause to show dizzy expression, then start walking back
    resetTimer = setTimeout(() => {
        friend.expression = 'normal';
        friend.y = friend.baseY;
        friend.angle = 0;
        friend.squash = 1; friend.stretch = 1;
        combo = 1;
        document.getElementById('combo-display').textContent = 'x1';
        document.getElementById('kick-hint').style.opacity = '0';
        state = GS.RETURNING; // walk back to kicker
    }, 700);
}

// ─── WADDLE BACK ─────────────────────────────────────────────
function updateReturning() {
    if (state !== GS.RETURNING) return;
    const targetX = kicker.x + 100;
    const dx = targetX - friend.x;
    if (Math.abs(dx) < 3) {
        friend.x = targetX;
        friend.y = friend.baseY;
        state = GS.IDLE;
        document.getElementById('kick-hint').style.opacity = '1';
    } else {
        // Smooth lerp — slows as it approaches
        friend.x += dx * 0.07;
        // Vertical waddle bob
        friend.y = friend.baseY - Math.abs(Math.sin(Date.now() * 0.012)) * 5;
    }
}

// ─── SCREEN SHAKE ────────────────────────────────────────────
let shake = { active: false, intensity: 0, endTime: 0 };
function shakeScreen(intensity, duration) {
    shake = { active: true, intensity, endTime: Date.now() + duration };
}

// ─── PARTICLES ───────────────────────────────────────────────
function spawnImpactParticles(x, y) {
    const colors = ['#e94560', '#f39c12', '#f1c40f', '#fff', '#e74c3c'];
    for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 1, decay: 0.03 + Math.random() * 0.04,
            r: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            type: 'circle',
        });
    }
    // Stars
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        particles.push({
            x, y: y - 20,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5 - 2,
            life: 1, decay: 0.025,
            r: 8, color: '#f1c40f', type: 'star',
        });
    }
}

function spawnBounceParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI; // upward hemisphere
        const speed = Math.random() * 5 + 1;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
            vy: -Math.sin(angle) * speed,
            life: 1, decay: 0.05,
            r: Math.random() * 4 + 1,
            color: '#aaa', type: 'circle',
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.2;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.type === 'star') {
            drawStar(ctx, p.x, p.y, 5, p.r, p.r / 2, p.color);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        }
        ctx.restore();
    });
}

function drawStar(c, x, y, spikes, outerR, innerR, color) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    c.beginPath();
    c.moveTo(x, y - outerR);
    for (let i = 0; i < spikes; i++) {
        c.lineTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
        rot += step;
        c.lineTo(x + Math.cos(rot) * innerR, y + Math.sin(rot) * innerR);
        rot += step;
    }
    c.lineTo(x, y - outerR);
    c.closePath();
    c.fillStyle = color;
    c.fill();
}

// ─── FLOATING TEXT ───────────────────────────────────────────
function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 1, decay: 0.022, vy: -1.8 });
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const f = floatingTexts[i];
        f.y += f.vy; f.life -= f.decay;
        if (f.life <= 0) floatingTexts.splice(i, 1);
    }
}

function drawFloatingTexts() {
    floatingTexts.forEach(f => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.font = `bold ${Math.round(22 + (1 - f.life) * 10)}px Segoe UI, Arial`;
        ctx.fillStyle = f.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    });
}

// ─── DRAW BACKGROUND ─────────────────────────────────────────
function drawBackground(offsetX, offsetY) {
    const W = canvas.width, H = canvas.height;
    const groundY = H * GROUND_Y_RATIO;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, PALETTE.sky1);
    grad.addColorStop(1, PALETTE.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars (parallax)
    ctx.save();
    stars.forEach(s => {
        const sx = ((s.x - offsetX * 0.1) % (W + 20) + W + 20) % (W + 20);
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
        ctx.fill();
    });
    ctx.restore();

    // Moon
    ctx.save();
    ctx.fillStyle = '#e8e8c0';
    ctx.shadowColor = '#ffffaa';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(W * 0.88, H * 0.12, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sky1;
    ctx.beginPath();
    ctx.arc(W * 0.88 + 10, H * 0.12 - 6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ground
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Ground edge glow
    const edgeGrad = ctx.createLinearGradient(0, groundY - 4, 0, groundY + 8);
    edgeGrad.addColorStop(0, PALETTE.groundTop);
    edgeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, groundY - 4, W, 14);

    // Floor tiles
    ctx.strokeStyle = 'rgba(233,69,96,0.15)';
    ctx.lineWidth = 1;
    const tileW = 80;
    const startTile = Math.floor(offsetX / tileW) * tileW - offsetX;
    for (let tx = startTile; tx < W + tileW; tx += tileW) {
        ctx.beginPath();
        ctx.moveTo(tx, groundY);
        ctx.lineTo(tx, H);
        ctx.stroke();
    }
}

// ─── DRAW CHARACTERS ─────────────────────────────────────────
// Simple stick-figure style with round heads and body

function drawKicker(c, x, y, kickFrame) {
    const p = PALETTE.kicker;
    const hs = 20;   // head radius
    const neck = 10;
    const torsoH = 44;
    const torsoW = 28;
    const legH = 42;
    const thighH = 22;
    const shinH = 20;
    const armUH = 22;
    const armLH = 18;
    const k = kickFrame;

    // Per-frame kick leg angle:
    // k=0: rest (straight down). k=1-2: wind-up (leg swings back = +CW).
    // k=3: start forward swing. k=4: IMPACT (leg extended right+up toward friend's butt).
    // k=5-6: follow-through (leg continues arc upward).
    const KICK_ANG = [0.0, 0.38, 0.68, -0.30, -2.05, -2.60, -2.25];
    const kickAngle = KICK_ANG[Math.min(k, 6)];

    // Lunge: whole body steps forward during kick, returns after impact
    const LUNGE = [0, 5, 12, 22, 32, 16, 5];
    const lunge = LUNGE[Math.min(k, 6)];

    const bodyTop = -legH - torsoH;
    const headCY = bodyTop - neck - hs;

    c.save();
    c.translate(x + lunge, y);

    // ── BACK LEG (plant / stand leg) ─────────────────────────
    // Shifted LEFT so it protrudes from under the torso (torso left edge ≈ x=-14)
    // Thigh shadow depth
    c.fillStyle = p.pantsDark;
    c.beginPath(); c.roundRect(-24, -thighH - shinH, 14, thighH, [5, 5, 2, 2]); c.fill();
    // Thigh main
    c.fillStyle = p.pants;
    c.beginPath(); c.roundRect(-25, -thighH - shinH - 1, 14, thighH, [5, 5, 2, 2]); c.fill();
    // Shin
    c.fillStyle = p.pants;
    c.beginPath(); c.roundRect(-23, -shinH, 13, shinH, [2, 2, 4, 4]); c.fill();
    // Inner crease
    c.strokeStyle = p.pantsDark; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-17, -shinH); c.lineTo(-17, -2); c.stroke();
    // Shoe body
    c.fillStyle = p.shoe;
    c.beginPath(); c.roundRect(-28, -7, 22, 9, [3, 3, 4, 4]); c.fill();
    // Sole stripe
    c.fillStyle = p.shoeSole;
    c.beginPath(); c.roundRect(-28, -3, 22, 3, 1); c.fill();
    // Lace
    c.strokeStyle = p.lace; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-24, -6); c.lineTo(-15, -4); c.stroke();

    // ── TORSO ────────────────────────────────────────────────
    // Jersey body
    c.fillStyle = p.shirt;
    c.beginPath();
    c.moveTo(-torsoW / 2, 0);
    c.lineTo(-torsoW / 2 - 3, bodyTop + 12);
    c.quadraticCurveTo(-torsoW / 2 - 2, bodyTop, -torsoW / 2 + 6, bodyTop);
    c.lineTo(torsoW / 2 - 6, bodyTop);
    c.quadraticCurveTo(torsoW / 2 + 2, bodyTop, torsoW / 2 + 3, bodyTop + 12);
    c.lineTo(torsoW / 2, 0);
    c.closePath(); c.fill();
    // Jersey shading stripe
    c.fillStyle = p.shirtDark;
    c.globalAlpha = 0.4;
    c.beginPath(); c.roundRect(-4, bodyTop + 4, 8, torsoH - 4, 2); c.fill();
    c.globalAlpha = 1;
    // Jersey collar
    c.fillStyle = p.shirtDark;
    c.beginPath(); c.roundRect(-8, bodyTop, 16, 10, [0, 0, 4, 4]); c.fill();
    c.fillStyle = p.shirt;
    c.beginPath(); c.roundRect(-5, bodyTop, 10, 8, [0, 0, 3, 3]); c.fill();

    // ── BACK ARM (swings FORWARD to balance the kick leg going out) ──────────────────────────────────
    // k=0: slightly back, k=1-2: neutral, k=3-4: swings forward past body, k=5-6: recovering
    const BACK_ARM_ANG = [-0.15, 0.0, -0.2, -0.55, -0.85, -0.60, -0.25];
    const armSwingBack = BACK_ARM_ANG[Math.min(k, 6)];
    c.save();
    c.translate(-torsoW / 2, bodyTop + 10);
    c.rotate(armSwingBack);
    c.fillStyle = p.shirt;
    c.beginPath(); c.roundRect(-6, 0, 11, armUH, [4, 4, 2, 2]); c.fill();
    c.fillStyle = p.shirt;
    c.beginPath(); c.roundRect(-5, armUH - 2, 10, armLH, [2, 2, 4, 4]); c.fill();
    // Hand
    c.fillStyle = p.skin;
    c.beginPath(); c.ellipse(0, armUH + armLH + 4, 6, 7, 0.2, 0, Math.PI * 2); c.fill();
    // Knuckle lines
    c.strokeStyle = p.skinShad; c.lineWidth = 0.8;
    for (let f = -2; f <= 2; f += 2) {
        c.beginPath(); c.arc(f, armUH + armLH + 4, 4, -0.3, 0.3); c.stroke();
    }
    c.restore();

    // ── FRONT ARM (swings BACK as kick leg goes forward) ─────────────────────────────
    const FRONT_ARM_ANG = [0.1, 0.35, 0.65, 0.85, 0.80, 0.50, 0.20];
    const armSwingFront = FRONT_ARM_ANG[Math.min(k, 6)];
    c.save();
    c.translate(torsoW / 2, bodyTop + 10);
    c.rotate(armSwingFront);
    c.fillStyle = p.shirt;
    c.beginPath(); c.roundRect(-5, 0, 11, armUH, [4, 4, 2, 2]); c.fill();
    c.fillStyle = p.skin; // forearm showing
    c.beginPath(); c.roundRect(-4, armUH - 2, 9, armLH, [2, 2, 4, 4]); c.fill();
    // Forearm shading
    c.fillStyle = p.skinShad;
    c.globalAlpha = 0.25;
    c.beginPath(); c.roundRect(-2, armUH - 2, 4, armLH, 2); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = p.skin;
    c.beginPath(); c.ellipse(0, armUH + armLH + 4, 6, 7, -0.2, 0, Math.PI * 2); c.fill();
    c.restore();

    // ── KICK LEG (drawn AFTER torso so it appears in front) ──
    c.save();
    c.translate(6, -legH * 0.4);
    c.rotate(kickAngle);
    // Thigh
    c.fillStyle = p.pants;
    c.beginPath(); c.roundRect(-6, 0, 14, thighH + 4, [5, 5, 2, 2]); c.fill();
    // Knee cap
    c.fillStyle = p.pantsDark;
    c.beginPath(); c.ellipse(1, thighH, 6, 4, 0, 0, Math.PI * 2); c.fill();
    // Shin
    c.fillStyle = p.pants;
    c.beginPath(); c.roundRect(-5, thighH, 13, shinH, [2, 2, 4, 4]); c.fill();
    // Crease line
    c.strokeStyle = p.pantsDark; c.lineWidth = 1;
    c.beginPath(); c.moveTo(1, thighH + 2); c.lineTo(1, thighH + shinH - 2); c.stroke();
    // Kick shoe — toe angles along with swing; at impact (k=4) toe pointed INTO target
    const SHOE_ANG = [0.0, 0.1, 0.15, 0.1, 0.30, 0.05, -0.15];
    const shoeAngle = SHOE_ANG[Math.min(k, 6)];
    c.save(); c.translate(1, thighH + shinH); c.rotate(shoeAngle);
    c.fillStyle = p.shoe;
    c.beginPath();
    c.moveTo(-8, 0); c.lineTo(20, -4); c.lineTo(22, 2); c.lineTo(-8, 6); c.closePath();
    c.fill();
    c.fillStyle = p.shoeSole;
    c.beginPath(); c.roundRect(-8, 2, 30, 3, 1); c.fill();
    c.strokeStyle = p.lace; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-2, -3); c.lineTo(8, -1); c.stroke();
    c.restore();
    c.restore();

    // ── NECK ─────────────────────────────────────────────────
    c.fillStyle = p.skin;
    c.beginPath(); c.roundRect(-6, headCY + hs - 4, 12, neck + 5, 3); c.fill();
    // Neck shadow
    c.fillStyle = p.skinShad;
    c.globalAlpha = 0.3;
    c.beginPath(); c.roundRect(-3, headCY + hs + 2, 5, neck, 2); c.fill();
    c.globalAlpha = 1;

    // ── HEAD ─────────────────────────────────────────────────
    // Head shadow / depth
    c.fillStyle = p.skinShad;
    c.beginPath(); c.ellipse(2, headCY + 2, hs, hs, 0, 0, Math.PI * 2); c.fill();
    // Head base
    c.fillStyle = p.skin;
    c.beginPath(); c.ellipse(0, headCY, hs, hs * 1.08, 0, 0, Math.PI * 2); c.fill();
    // Highlight on forehead
    c.fillStyle = p.skinHL;
    c.globalAlpha = 0.45;
    c.beginPath(); c.ellipse(-4, headCY - hs * 0.35, hs * 0.35, hs * 0.22, -0.4, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    // Ear
    c.fillStyle = p.skin;
    c.beginPath(); c.ellipse(-hs + 3, headCY + 2, 5, 7, -0.15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.skinShad; c.lineWidth = 1;
    c.beginPath(); c.arc(-hs + 4, headCY + 2, 3, -0.8, 0.8); c.stroke();

    // ── HAIR (short, side-parted) ─────────────────────────────
    c.fillStyle = p.hair;
    c.beginPath();
    c.ellipse(0, headCY - hs * 0.15, hs * 0.95, hs * 0.75, 0, Math.PI, 0);
    c.fill();
    // Side part detail
    c.beginPath();
    c.ellipse(-hs * 0.72, headCY - hs * 0.1, hs * 0.28, hs * 0.5, -0.18, 0, Math.PI * 2);
    c.fill();
    // Hair shine
    c.fillStyle = '#3a2010';
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(-6, headCY - hs * 0.85);
    c.quadraticCurveTo(4, headCY - hs, 12, headCY - hs * 0.85);
    c.quadraticCurveTo(4, headCY - hs * 0.7, -6, headCY - hs * 0.85);
    c.fill();
    c.globalAlpha = 1;

    // ── FACE features ────────────────────────────────────────
    // Angry crease between brows
    c.strokeStyle = p.skinShad; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-3, headCY - hs * 0.18); c.lineTo(0, headCY - hs * 0.1); c.stroke();

    // Eyebrows (angled down — angry)
    c.fillStyle = p.hair;
    // Left brow
    c.beginPath();
    c.moveTo(-hs * 0.5, headCY - hs * 0.22);
    c.lineTo(-hs * 0.12, headCY - hs * 0.1);
    c.lineTo(-hs * 0.1, headCY - hs * 0.06);
    c.lineTo(-hs * 0.52, headCY - hs * 0.17);
    c.closePath(); c.fill();
    // Right brow
    c.beginPath();
    c.moveTo(hs * 0.5, headCY - hs * 0.22);
    c.lineTo(hs * 0.12, headCY - hs * 0.1);
    c.lineTo(hs * 0.1, headCY - hs * 0.06);
    c.lineTo(hs * 0.52, headCY - hs * 0.17);
    c.closePath(); c.fill();

    // Eyes – almond shape
    const eyY = headCY - hs * 0.05;
    [-hs * 0.35, hs * 0.35].forEach((ex, i) => {
        // White sclera
        c.fillStyle = '#f5f0e8';
        c.beginPath(); c.ellipse(ex, eyY, 5.5, 4, i === 0 ? 0.1 : -0.1, 0, Math.PI * 2); c.fill();
        // Iris
        c.fillStyle = '#2a1a08';
        c.beginPath(); c.ellipse(ex + (i === 0 ? 0.5 : -0.5), eyY + 0.5, 3.2, 3.2, 0, 0, Math.PI * 2); c.fill();
        // Pupil
        c.fillStyle = '#080400';
        c.beginPath(); c.arc(ex + (i === 0 ? 0.5 : -0.5), eyY + 0.5, 1.8, 0, Math.PI * 2); c.fill();
        // Eye shine
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(ex + (i === 0 ? 1 : -1), eyY - 1, 1, 0, Math.PI * 2); c.fill();
        // Upper eyelid line
        c.strokeStyle = p.hair; c.lineWidth = 1;
        c.beginPath(); c.ellipse(ex, eyY, 5.5, 4, i === 0 ? 0.1 : -0.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    });

    // Nose
    c.strokeStyle = p.skinShad; c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(2, headCY + hs * 0.04);
    c.quadraticCurveTo(5, headCY + hs * 0.22, 3, headCY + hs * 0.3);
    c.stroke();
    c.beginPath();
    c.moveTo(-4, headCY + hs * 0.3);
    c.quadraticCurveTo(-1, headCY + hs * 0.34, 3, headCY + hs * 0.3);
    c.stroke();

    // Lips / smirk
    c.fillStyle = p.lip;
    c.beginPath();
    c.moveTo(-7, headCY + hs * 0.48);
    c.quadraticCurveTo(0, headCY + hs * 0.42, 7, headCY + hs * 0.48);
    c.quadraticCurveTo(4, headCY + hs * 0.56, 0, headCY + hs * 0.55);
    c.quadraticCurveTo(-3, headCY + hs * 0.56, -7, headCY + hs * 0.48);
    c.fill();
    // Smirk crease
    c.strokeStyle = p.skinShad; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(7, headCY + hs * 0.48); c.quadraticCurveTo(10, headCY + hs * 0.52, 9, headCY + hs * 0.56); c.stroke();

    c.restore();
}

function drawFriend(c, x, y, angle, squash, stretch, expression) {
    const pal = PALETTE.friend;
    const FAT = 1.42;
    const hs = 24 * FAT;
    const torsoW = 46 * FAT;
    const torsoH = 46;
    const legH = 32;
    const armH = 28;

    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(stretch, squash);

    // ── BUTT / REAR END (drawn first so legs sit in front) ───
    // The friend faces LEFT so the right side is his back/rear.
    // Two big rounded cheeks protruding right, with shadow depth.
    const buttCX = torsoW * 0.52;   // horizontal centre of butt
    const buttCY = -legH - 4;       // sits just above ground / top of legs
    const buttW = torsoW * 0.38;   // how far it sticks out
    const buttH = 22;              // height of each cheek

    // Shadow blob behind (depth)
    c.fillStyle = pal.kurtaDark;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.ellipse(buttCX + 5, buttCY - buttH * 0.45 + 2, buttW * 0.72, buttH * 0.68, 0.15, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(buttCX + 5, buttCY - buttH * 1.35 + 2, buttW * 0.68, buttH * 0.64, -0.12, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // Lower cheek (bottom)
    c.fillStyle = pal.pants;
    c.beginPath();
    c.ellipse(buttCX, buttCY - buttH * 0.44, buttW * 0.68, buttH * 0.66, 0.12, 0, Math.PI * 2);
    c.fill();
    // Lower cheek shading
    c.fillStyle = pal.pantsShad;
    c.globalAlpha = 0.45;
    c.beginPath();
    c.ellipse(buttCX + buttW * 0.18, buttCY - buttH * 0.44, buttW * 0.44, buttH * 0.48, 0.18, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // Upper cheek (top)
    c.fillStyle = pal.pants;
    c.beginPath();
    c.ellipse(buttCX - 3, buttCY - buttH * 1.32, buttW * 0.65, buttH * 0.62, -0.14, 0, Math.PI * 2);
    c.fill();
    // Upper cheek shading
    c.fillStyle = pal.pantsShad;
    c.globalAlpha = 0.4;
    c.beginPath();
    c.ellipse(buttCX + buttW * 0.14, buttCY - buttH * 1.32, buttW * 0.42, buttH * 0.44, -0.1, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // Butt crack line — natural centre crease between cheeks
    c.strokeStyle = pal.pantsShad; c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(buttCX - buttW * 0.05, buttCY - buttH * 0.1);
    c.quadraticCurveTo(buttCX + buttW * 0.08, buttCY - buttH * 0.9, buttCX - buttW * 0.08, buttCY - buttH * 1.7);
    c.stroke();

    // Fabric stress wrinkle at butt-to-thigh join
    c.strokeStyle = pal.pantsShad; c.lineWidth = 1.0; c.globalAlpha = 0.6;
    c.beginPath();
    c.moveTo(buttCX - buttW * 0.3, buttCY - buttH * 0.25);
    c.quadraticCurveTo(buttCX, buttCY - buttH * 0.08, buttCX + buttW * 0.2, buttCY - buttH * 0.3);
    c.stroke();
    c.globalAlpha = 1;

    // ── WHITE PAJAMA LEGS ──────────────────────────────────────
    const lLegX = -torsoW * 0.42;
    const rLegX = torsoW * 0.07;
    const legW = torsoW * 0.35;
    // Leg shadow / crease
    c.fillStyle = pal.pantsShad;
    c.beginPath(); c.roundRect(lLegX + 3, -legH + 6, legW - 6, legH, [1, 1, 4, 4]); c.fill();
    c.beginPath(); c.roundRect(rLegX + 3, -legH + 6, legW - 6, legH, [1, 1, 4, 4]); c.fill();
    // Main trouser shapes
    c.fillStyle = pal.pants;
    c.beginPath(); c.roundRect(lLegX, -legH, legW, legH + 2, [2, 2, 6, 6]); c.fill();
    c.beginPath(); c.roundRect(rLegX, -legH, legW, legH + 2, [2, 2, 6, 6]); c.fill();
    // Inner crease lines
    c.strokeStyle = pal.pantsShad; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(lLegX + legW * 0.5, -legH + 4); c.lineTo(lLegX + legW * 0.5, -4); c.stroke();
    c.beginPath(); c.moveTo(rLegX + legW * 0.5, -legH + 4); c.lineTo(rLegX + legW * 0.5, -4); c.stroke();

    // ── SANDALS ───────────────────────────────────────────────
    // Sole
    c.fillStyle = pal.shoe;
    c.beginPath(); c.roundRect(lLegX - 4, -5, legW + 4, 8, [2, 2, 4, 4]); c.fill();
    c.beginPath(); c.roundRect(rLegX - 4, -5, legW + 4, 8, [2, 2, 4, 4]); c.fill();
    // Strap
    c.fillStyle = pal.shoeSole;
    c.beginPath(); c.roundRect(lLegX + 1, -7, legW - 2, 4, 2); c.fill();
    c.beginPath(); c.roundRect(rLegX + 1, -7, legW - 2, 4, 2); c.fill();
    // Toe-post shadow
    c.fillStyle = pal.shoe;
    c.globalAlpha = 0.4;
    c.beginPath(); c.roundRect(lLegX + legW * 0.42, -7, 4, 10, 1); c.fill();
    c.beginPath(); c.roundRect(rLegX + legW * 0.42, -7, 4, 10, 1); c.fill();
    c.globalAlpha = 1;

    // ── KURTA BODY ────────────────────────────────────────────
    // Shadow/dark layer first
    c.fillStyle = pal.kurtaDark;
    c.beginPath();
    c.moveTo(-torsoW * 0.64, -legH - 2);
    c.lineTo(-torsoW * 0.70, -legH - torsoH * 0.42);
    c.quadraticCurveTo(-torsoW * 0.72, -legH - torsoH - 4, -torsoW * 0.54, -legH - torsoH - 10);
    c.lineTo(torsoW * 0.54, -legH - torsoH - 10);
    c.quadraticCurveTo(torsoW * 0.72, -legH - torsoH - 4, torsoW * 0.70, -legH - torsoH * 0.42);
    c.lineTo(torsoW * 0.64, -legH - 2);
    c.closePath(); c.fill();
    // Main kurta
    c.fillStyle = pal.kurta;
    c.beginPath();
    c.moveTo(-torsoW * 0.60, -legH - 2);
    c.lineTo(-torsoW * 0.66, -legH - torsoH * 0.38);
    c.quadraticCurveTo(-torsoW * 0.68, -legH - torsoH + 2, -torsoW * 0.50, -legH - torsoH - 8);
    c.lineTo(torsoW * 0.50, -legH - torsoH - 8);
    c.quadraticCurveTo(torsoW * 0.68, -legH - torsoH + 2, torsoW * 0.66, -legH - torsoH * 0.38);
    c.lineTo(torsoW * 0.60, -legH - 2);
    c.closePath(); c.fill();
    // Chest highlight (fabric shine)
    c.fillStyle = pal.kurtaHL;
    c.globalAlpha = 0.4;
    c.beginPath(); c.ellipse(0, -legH - torsoH * 0.62, torsoW * 0.18, torsoH * 0.28, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    // Side fold lines
    c.strokeStyle = pal.kurtaDark; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-torsoW * 0.38, -legH - torsoH * 0.8); c.quadraticCurveTo(-torsoW * 0.42, -legH - torsoH * 0.5, -torsoW * 0.36, -legH - 4); c.stroke();
    c.beginPath(); c.moveTo(torsoW * 0.38, -legH - torsoH * 0.8); c.quadraticCurveTo(torsoW * 0.42, -legH - torsoH * 0.5, torsoW * 0.36, -legH - 4); c.stroke();
    // Hem decorative border
    c.strokeStyle = pal.kurtaDot; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-torsoW * 0.60, -legH - 2); c.lineTo(torsoW * 0.60, -legH - 2); c.stroke();

    // Button placket
    c.fillStyle = pal.kurtaDark;
    c.beginPath(); c.roundRect(-4, -legH - torsoH + 6, 8, torsoH - 6, 2); c.fill();
    c.fillStyle = pal.kurtaHL;
    c.globalAlpha = 0.6;
    c.beginPath(); c.roundRect(-1.5, -legH - torsoH + 6, 3, torsoH - 6, 1); c.fill();
    c.globalAlpha = 1;
    // Buttons
    c.fillStyle = '#aec6f0';
    for (let bi = 0; bi < 4; bi++) {
        c.beginPath(); c.arc(0, -legH - torsoH + 16 + bi * 9, 1.8, 0, Math.PI * 2); c.fill();
        // Button shadow
        c.fillStyle = '#7898c0';
        c.beginPath(); c.arc(0.6, -legH - torsoH + 16.6 + bi * 9, 1, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#aec6f0';
    }

    // Fabric dots
    c.fillStyle = pal.kurtaDot;
    c.globalAlpha = 0.55;
    const dotP = [
        [-20, -legH - torsoH * 0.3], [20, -legH - torsoH * 0.3],
        [-30, -legH - torsoH * 0.6], [30, -legH - torsoH * 0.6],
        [-14, -legH - torsoH * 0.8], [14, -legH - torsoH * 0.8],
        [-25, -legH - torsoH * 0.15], [25, -legH - torsoH * 0.15],
        [-36, -legH - torsoH * 0.46], [36, -legH - torsoH * 0.46],
        [0, -legH - torsoH * 0.55],
    ];
    dotP.forEach(([dx, dy]) => { c.beginPath(); c.arc(dx, dy, 1.5, 0, Math.PI * 2); c.fill(); });
    c.globalAlpha = 1;

    // V-neck collar
    c.strokeStyle = pal.kurtaDark; c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-12, -legH - torsoH - 4);
    c.lineTo(0, -legH - torsoH + 12);
    c.lineTo(12, -legH - torsoH - 4);
    c.stroke();
    // Collar highlight
    c.strokeStyle = pal.kurtaHL; c.lineWidth = 0.9; c.globalAlpha = 0.6;
    c.beginPath();
    c.moveTo(-10, -legH - torsoH - 3);
    c.lineTo(0, -legH - torsoH + 10);
    c.lineTo(10, -legH - torsoH - 3);
    c.stroke();
    c.globalAlpha = 1;

    // ── CHUBBY ARMS ───────────────────────────────────────────
    // Left arm
    c.save();
    c.translate(-torsoW * 0.58, -legH - torsoH * 0.78);
    c.rotate(0.5);
    // Upper arm (kurta-covered, fat)
    c.fillStyle = pal.kurtaDark;
    c.beginPath(); c.ellipse(1, armH * 0.4, 12, armH * 0.55, 0.08, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.kurta;
    c.beginPath(); c.ellipse(0, armH * 0.38, 11, armH * 0.52, 0, 0, Math.PI * 2); c.fill();
    // Sleeve border at wrist
    c.strokeStyle = pal.kurtaDark; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, armH * 0.85, 10, 4, 0, 0, Math.PI * 2); c.stroke();
    // Forearm / wrist skin
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(1, armH + 3, 9, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, armH + 2, 9, 7, 0, 0, Math.PI * 2); c.fill();
    // Wristwatch
    c.strokeStyle = '#a0a0a0'; c.lineWidth = 3.5;
    c.beginPath(); c.arc(0, armH - 2, 9, -0.8, 0.8); c.stroke();
    c.fillStyle = '#dde8ee';
    c.beginPath(); c.roundRect(-5, armH - 7, 10, 9, 2); c.fill();
    c.fillStyle = '#222';
    c.beginPath(); c.roundRect(-4, armH - 6, 8, 7, 1); c.fill();
    // Clock hands
    c.strokeStyle = '#e0e0e0'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, armH - 3); c.lineTo(2, armH - 1); c.stroke();
    c.beginPath(); c.moveTo(0, armH - 3); c.lineTo(-2, armH - 5); c.stroke();
    // Hand
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(1, armH + 12, 7, 8, 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, armH + 11, 7, 8, 0, 0, Math.PI * 2); c.fill();
    // finger creases
    c.strokeStyle = pal.skinShad; c.lineWidth = 0.8;
    for (let fi = -3; fi <= 3; fi += 3) {
        c.beginPath(); c.arc(fi, armH + 11, 5, -0.4, 0.4); c.stroke();
    }
    c.restore();

    // Right arm
    c.save();
    c.translate(torsoW * 0.58, -legH - torsoH * 0.78);
    c.rotate(-0.5);
    c.fillStyle = pal.kurtaDark;
    c.beginPath(); c.ellipse(-1, armH * 0.4, 12, armH * 0.55, -0.08, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.kurta;
    c.beginPath(); c.ellipse(0, armH * 0.38, 11, armH * 0.52, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = pal.kurtaDark; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, armH * 0.85, 10, 4, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(-1, armH + 3, 9, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, armH + 2, 9, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(-1, armH + 12, 7, 8, -0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, armH + 11, 7, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = pal.skinShad; c.lineWidth = 0.8;
    for (let fi = -3; fi <= 3; fi += 3) {
        c.beginPath(); c.arc(fi, armH + 11, 5, -0.4, 0.4); c.stroke();
    }
    c.restore();

    // ── HEAD ─────────────────────────────────────────────────
    const headY = -legH - torsoH - hs * 0.95;

    // Neck (thick, shaded)
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.roundRect(-9, headY + hs - 2, 18, 15, 4); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.roundRect(-10, headY + hs - 4, 18, 15, 4); c.fill();
    // Neck shadow crease
    c.fillStyle = pal.skinShad;
    c.globalAlpha = 0.25;
    c.beginPath(); c.ellipse(0, headY + hs + 6, 6, 3, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    // Head shadow offset
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(2, headY + 3, hs * 0.88, hs, 0, 0, Math.PI * 2); c.fill();
    // Head base
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, headY, hs * 0.88, hs, 0, 0, Math.PI * 2); c.fill();
    // Forehead highlight
    c.fillStyle = pal.skinHL;
    c.globalAlpha = 0.4;
    c.beginPath(); c.ellipse(-5, headY - hs * 0.32, hs * 0.32, hs * 0.2, -0.3, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    // Ears (visible on both sides)
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(-hs * 0.84 + 1, headY + 3, 6, 9, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(-hs * 0.84, headY + 2, 6, 9, -0.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = pal.skinShad; c.lineWidth = 1;
    c.beginPath(); c.arc(-hs * 0.84, headY + 2, 3.5, -0.7, 0.7); c.stroke();
    c.fillStyle = pal.skinShad;
    c.beginPath(); c.ellipse(hs * 0.84 - 1, headY + 3, 6, 9, 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(hs * 0.84, headY + 2, 6, 9, 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(hs * 0.84, headY + 2, 3.5, Math.PI - 0.7, Math.PI + 0.7); c.stroke();

    // Double chin
    c.fillStyle = pal.skin;
    c.beginPath(); c.ellipse(0, headY + hs * 0.74, hs * 0.5, hs * 0.27, 0, 0, Math.PI); c.fill();
    // Chin crease
    c.strokeStyle = pal.skinShad; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, headY + hs * 0.58, hs * 0.32, 0.2, Math.PI - 0.2); c.stroke();

    // Chubby cheek flush
    c.fillStyle = 'rgba(190, 90, 70, 0.22)';
    c.beginPath(); c.ellipse(-hs * 0.54, headY + hs * 0.19, 12, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(hs * 0.54, headY + hs * 0.19, 12, 8, 0, 0, Math.PI * 2); c.fill();

    // ── HAIR ─────────────────────────────────────────────────
    c.fillStyle = pal.hair;
    c.beginPath();
    c.ellipse(0, headY - hs * 0.1, hs * 0.86, hs * 0.7, 0, Math.PI, 0);
    c.fill();
    // Sideburns
    c.beginPath(); c.ellipse(-hs * 0.8, headY + hs * 0.06, hs * 0.17, hs * 0.36, -0.18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(hs * 0.8, headY + hs * 0.06, hs * 0.17, hs * 0.36, 0.18, 0, Math.PI * 2); c.fill();
    // Hair shine streak
    c.fillStyle = '#2e1a08';
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(-8, headY - hs * 0.82);
    c.quadraticCurveTo(3, headY - hs * 0.96, 14, headY - hs * 0.82);
    c.quadraticCurveTo(4, headY - hs * 0.68, -8, headY - hs * 0.82);
    c.fill();
    c.globalAlpha = 1;

    // Face expressions (eyes + mouth)
    drawFace(c, 0, headY, hs, expression);

    // ── GLASSES ───────────────────────────────────────────────
    drawGlasses(c, 0, headY, hs, expression);

    c.restore();
}

// ── GLASSES helper ────────────────────────────────────────────
function drawGlasses(c, cx, cy, hs, expression) {
    const pal = PALETTE.friend;
    const gw = hs * 0.36;
    const gh = hs * 0.27;
    const sep = hs * 0.44;
    const gy = cy - hs * 0.07;

    const gyOff = (expression === 'shocked') ? -hs * 0.14 : 0;
    const tilt = (expression === 'shocked') ? 0.2 : 0;

    c.save();
    c.translate(cx, gy + gyOff);
    c.rotate(tilt);

    // Lens tint fill
    c.fillStyle = 'rgba(140,200,255,0.12)';
    c.beginPath(); c.ellipse(-sep, 0, gw, gh, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sep, 0, gw, gh, 0, 0, Math.PI * 2); c.fill();
    // Lens glare highlight
    c.fillStyle = pal.glassHL;
    c.globalAlpha = 0.55;
    c.beginPath(); c.ellipse(-sep - gw * 0.3, -gh * 0.35, gw * 0.22, gh * 0.18, -0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sep - gw * 0.3, -gh * 0.35, gw * 0.22, gh * 0.18, -0.4, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    // Thin metal frames
    c.strokeStyle = pal.glass; c.lineWidth = 1.8;
    c.beginPath(); c.ellipse(-sep, 0, gw, gh, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(sep, 0, gw, gh, 0, 0, Math.PI * 2); c.stroke();

    // Nose bridge
    c.beginPath();
    c.moveTo(-sep + gw, -gh * 0.15);
    c.quadraticCurveTo(0, -gh * 0.6, sep - gw, -gh * 0.15);
    c.stroke();

    // Temple arms
    c.beginPath(); c.moveTo(-sep - gw, -gh * 0.3); c.lineTo(-sep - gw - hs * 0.38, -gh * 0.05); c.stroke();
    c.beginPath(); c.moveTo(sep + gw, -gh * 0.3); c.lineTo(sep + gw + hs * 0.38, -gh * 0.05); c.stroke();

    c.restore();
}

function drawFace(c, cx, cy, hs, expression) {
    const pal = PALETTE.friend;
    const sep = hs * 0.44;
    const ey = cy - hs * 0.07;

    // ── Eyebrows (thick, arched) ────────────────────────────
    const browR = (expression === 'shocked') ? -0.35 : (expression === 'dizzy') ? 0.2 : 0.1;
    c.fillStyle = pal.hair;
    // Left brow
    c.save(); c.translate(cx - sep, ey - hs * 0.35); c.rotate(-browR);
    c.beginPath(); c.roundRect(-hs * 0.25, -2, hs * 0.5, 4, 2); c.fill();
    c.restore();
    // Right brow
    c.save(); c.translate(cx + sep, ey - hs * 0.35); c.rotate(browR);
    c.beginPath(); c.roundRect(-hs * 0.25, -2, hs * 0.5, 4, 2); c.fill();
    c.restore();

    // ── Nose (broad, bulbous) ────────────────────────────────
    c.strokeStyle = pal.skinShad; c.lineWidth = 1.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx + 2, cy + hs * 0.01);
    c.quadraticCurveTo(cx + 7, cy + hs * 0.18, cx + 4, cy + hs * 0.28);
    c.stroke();
    c.beginPath();
    c.moveTo(cx - 5, cy + hs * 0.28);
    c.quadraticCurveTo(cx, cy + hs * 0.33, cx + 4, cy + hs * 0.28);
    c.stroke();
    // Nostril dots
    c.fillStyle = pal.skinShad; c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(cx - 3.5, cy + hs * 0.29, 2.5, 2, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + 4, cy + hs * 0.29, 2.5, 2, -0.2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    switch (expression) {
        case 'shocked': {
            // Wide open eyes
            c.fillStyle = '#f5f0e8';
            c.beginPath(); c.ellipse(cx - sep, ey, 6.5, 6, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep, ey, 6.5, 6, 0, 0, Math.PI * 2); c.fill();
            // Irises
            c.fillStyle = '#3a200e';
            c.beginPath(); c.ellipse(cx - sep + 1, ey + 1, 4, 4, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep + 1, ey + 1, 4, 4, 0, 0, Math.PI * 2); c.fill();
            // Pupils
            c.fillStyle = '#080400';
            c.beginPath(); c.arc(cx - sep + 1, ey + 1, 2.2, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(cx + sep + 1, ey + 1, 2.2, 0, Math.PI * 2); c.fill();
            // Eye shine
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(cx - sep + 2, ey, 1.2, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(cx + sep + 2, ey, 1.2, 0, Math.PI * 2); c.fill();
            // Open mouth
            c.fillStyle = '#3a1008';
            c.beginPath(); c.ellipse(cx, cy + hs * 0.42, 11, 9, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#d06060';
            c.beginPath(); c.ellipse(cx, cy + hs * 0.44, 8, 6, 0, 0, Math.PI * 2); c.fill();
            // Tongue
            c.fillStyle = '#e08080';
            c.beginPath(); c.ellipse(cx, cy + hs * 0.48, 5, 3, 0, 0, Math.PI); c.fill();
            // Sweat drop
            c.fillStyle = '#7ac8e8';
            c.beginPath();
            c.moveTo(cx + hs * 0.9, cy - hs * 0.16);
            c.quadraticCurveTo(cx + hs * 1.06, cy + hs * 0.04, cx + hs * 0.9, cy + hs * 0.22);
            c.quadraticCurveTo(cx + hs * 0.74, cy + hs * 0.04, cx + hs * 0.9, cy - hs * 0.16);
            c.fill();
            break;
        }
        case 'crying': {
            c.fillStyle = '#f5f0e8';
            c.beginPath(); c.ellipse(cx - sep, ey, 5.5, 5, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep, ey, 5.5, 5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#3a200e';
            c.beginPath(); c.ellipse(cx - sep + 0.5, ey + 1, 3.2, 3.2, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep + 0.5, ey + 1, 3.2, 3.2, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#080400';
            c.beginPath(); c.arc(cx - sep + 0.5, ey + 1, 1.8, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(cx + sep + 0.5, ey + 1, 1.8, 0, Math.PI * 2); c.fill();
            // Tear streaks
            c.strokeStyle = '#a0d4f5'; c.lineWidth = 3; c.lineCap = 'round';
            c.beginPath(); c.moveTo(cx - sep, ey + 6); c.quadraticCurveTo(cx - sep - 5, cy + hs * 0.28, cx - sep - 3, cy + hs * 0.46); c.stroke();
            c.beginPath(); c.moveTo(cx + sep, ey + 6); c.quadraticCurveTo(cx + sep + 5, cy + hs * 0.28, cx + sep + 3, cy + hs * 0.46); c.stroke();
            // Second tear drops
            c.fillStyle = '#a0d4f5';
            c.beginPath(); c.ellipse(cx - sep - 3, cy + hs * 0.48, 3, 4, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep + 3, cy + hs * 0.48, 3, 4, 0, 0, Math.PI * 2); c.fill();
            // Sad mouth
            c.strokeStyle = pal.lip; c.lineWidth = 2.8; c.lineCap = 'round';
            c.beginPath(); c.arc(cx, cy + hs * 0.5, 9, Math.PI * 0.1, Math.PI * 0.88, true); c.stroke();
            break;
        }
        case 'dizzy': {
            // X eyes with spiral hint
            c.strokeStyle = '#d03020'; c.lineWidth = 2.8; c.lineCap = 'round';
            [cx - sep, cx + sep].forEach(ex => {
                c.beginPath(); c.moveTo(ex - 5, ey - 5); c.lineTo(ex + 5, ey + 5); c.stroke();
                c.beginPath(); c.moveTo(ex + 5, ey - 5); c.lineTo(ex - 5, ey + 5); c.stroke();
            });
            // Stars
            for (let si = 0; si < 3; si++) {
                const sa = (si / 3) * Math.PI * 2 - Math.PI / 2;
                drawStar(c, cx + Math.cos(sa) * hs * 1.05, cy - hs * 0.5 + Math.sin(sa) * hs * 0.38, 5, 7, 3, '#f1c40f');
            }
            // Wavy mouth
            c.strokeStyle = pal.lip; c.lineWidth = 2.2; c.lineCap = 'round';
            c.beginPath();
            c.moveTo(cx - 10, cy + hs * 0.38);
            c.quadraticCurveTo(cx - 4, cy + hs * 0.32, cx, cy + hs * 0.42);
            c.quadraticCurveTo(cx + 4, cy + hs * 0.32, cx + 10, cy + hs * 0.38);
            c.stroke();
            break;
        }
        default: { // normal
            // Eyes — almond shaped
            c.fillStyle = '#f5f0e8';
            c.beginPath(); c.ellipse(cx - sep, ey, 6, 4.5, 0.05, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep, ey, 6, 4.5, -0.05, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#5a3218';
            c.beginPath(); c.ellipse(cx - sep + 0.5, ey + 0.5, 3.5, 3.5, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.ellipse(cx + sep + 0.5, ey + 0.5, 3.5, 3.5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#100800';
            c.beginPath(); c.arc(cx - sep + 0.5, ey + 0.5, 2, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(cx + sep + 0.5, ey + 0.5, 2, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(cx - sep + 1.5, ey - 0.5, 1, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(cx + sep + 1.5, ey - 0.5, 1, 0, Math.PI * 2); c.fill();
            // Upper eyelid line
            c.strokeStyle = pal.hair; c.lineWidth = 1;
            c.beginPath(); c.ellipse(cx - sep, ey, 6, 4.5, 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
            c.beginPath(); c.ellipse(cx + sep, ey, 6, 4.5, -0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
            // Gentle smile — fuller lips
            c.fillStyle = pal.lip;
            c.beginPath();
            c.moveTo(cx - 9, cy + hs * 0.44);
            c.quadraticCurveTo(cx, cy + hs * 0.38, cx + 9, cy + hs * 0.44);
            c.quadraticCurveTo(cx + 6, cy + hs * 0.54, cx, cy + hs * 0.53);
            c.quadraticCurveTo(cx - 6, cy + hs * 0.54, cx - 9, cy + hs * 0.44);
            c.fill();
            // Lip line
            c.strokeStyle = pal.skinShad; c.lineWidth = 0.8;
            c.beginPath(); c.moveTo(cx - 9, cy + hs * 0.44); c.quadraticCurveTo(cx, cy + hs * 0.38, cx + 9, cy + hs * 0.44); c.stroke();
        }
    }
}

// ─── SCORE DISPLAY EFFECTS ───────────────────────────────────
let hudPulse = false;
function updateHUD() {
    document.getElementById('score-display').textContent = score;
    document.getElementById('high-score-display').textContent = Math.max(score, highScore);
    hudPulse = true;
}

// ─── CAMERA / SCROLL ─────────────────────────────────────────
let camX = 0;
function updateCamera() {
    if (friend.isFlying) {
        // Follow friend when flying
        const targetX = friend.x - canvas.width * 0.4;
        camX += (targetX - camX) * 0.08;
    } else {
        // Return to start
        camX += (0 - camX) * 0.05;
    }
}

// ─── MAIN LOOP ───────────────────────────────────────────────
let lastTime = 0;
function loop(ts = 0) {
    if (!gameActive) return;

    // Screen shake offset
    let sx = 0, sy = 0;
    if (shake.active) {
        if (Date.now() < shake.endTime) {
            const t = 1 - (shake.endTime - Date.now()) / 200;
            sx = (Math.random() - 0.5) * shake.intensity * (1 - t);
            sy = (Math.random() - 0.5) * shake.intensity * (1 - t);
        } else {
            shake.active = false;
        }
    }

    updateCamera();
    updateKicker();
    updateFriend();
    updateReturning();
    updateParticles();
    updateFloatingTexts();

    // ── DRAW ──
    ctx.save();
    ctx.translate(sx, sy);

    // Background (fixed - no camera scroll for sky)
    drawBackground(camX, 0);

    // Camera transform for characters
    ctx.save();
    ctx.translate(-camX, 0);

    const groundY = canvas.height * GROUND_Y_RATIO;
    drawKicker(ctx, kicker.x, groundY, kicker.kickFrame);
    drawFriend(ctx, friend.x, friend.y, friend.angle, friend.squash, friend.stretch, friend.expression);
    drawParticles();

    ctx.restore(); // camera

    drawFloatingTexts();

    // Combo flash
    if (combo > 1 && friend.isFlying) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = combo > 5 ? '#e94560' : '#f39c12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    ctx.restore(); // shake

    animFrame = requestAnimationFrame(loop);
}

// ─── PREVIEW ANIMATION ───────────────────────────────────────
let previewFrame = 0;
function drawPreview() {
    pctx.clearRect(0, 0, preview.width, preview.height);
    const W = preview.width, H = preview.height;

    // Background
    const grad = pctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(1, '#1a3a5c');
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, W, H);

    // Ground
    pctx.fillStyle = '#1a1a2e';
    pctx.fillRect(0, H * 0.72, W, H * 0.28);
    pctx.fillStyle = '#e94560';
    pctx.fillRect(0, H * 0.72 - 2, W, 3);

    const groundY = H * 0.72;
    const kickF = Math.floor(previewFrame / 8) % 7;
    drawKicker(pctx, W * 0.32, groundY, kickF);
    drawFriend(pctx, W * 0.62, groundY, 0, 1, 1, kickF > 3 ? 'shocked' : 'normal');

    previewFrame++;
    requestAnimationFrame(drawPreview);
}
drawPreview();

// ─── BUTTON LISTENERS ────────────────────────────────────────
document.getElementById('play-btn').addEventListener('click', () => {
    showScreen('game');
    initGame();
});

document.getElementById('howto-btn').addEventListener('click', () => {
    showScreen('howto');
});
document.getElementById('back-btn').addEventListener('click', () => {
    showScreen('menu');
});

document.getElementById('pause-btn').addEventListener('click', () => {
    gameActive = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    showScreen('pause');
    screens.pause.classList.add('active');
    screens.game.classList.add('active');
});

document.getElementById('resume-btn').addEventListener('click', () => {
    screens.pause.classList.remove('active');
    gameActive = true;
    loop();
});

document.getElementById('quit-btn').addEventListener('click', () => {
    gameActive = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    showScreen('menu');
    document.getElementById('menu-high-score').textContent = highScore;
});

document.getElementById('retry-btn').addEventListener('click', () => {
    showScreen('game');
    initGame();
});

document.getElementById('menu-btn').addEventListener('click', () => {
    showScreen('menu');
    document.getElementById('menu-high-score').textContent = highScore;
});

// ─── KICK INPUT ──────────────────────────────────────────────
canvas.addEventListener('click', doKick);
canvas.addEventListener('touchstart', e => { e.preventDefault(); doKick(); });

window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (screens.game.classList.contains('active') && !screens.pause.classList.contains('active')) {
            doKick();
        }
    }
    if (e.code === 'Escape') {
        if (screens.game.classList.contains('active')) {
            document.getElementById('pause-btn').click();
        }
    }
});

// ─── GAME OVER (timed game – 30s) ───────────────────────────
let gameTimer = null;
let countdownInterval = null;
const GAME_DURATION = 30000; // 30 seconds

function startGameTimer() {
    if (gameTimer) clearTimeout(gameTimer);
    if (countdownInterval) clearInterval(countdownInterval);

    gameTimer = setTimeout(endGame, GAME_DURATION);

    // Reset timer bar
    const timerBar = document.getElementById('timer-bar');
    const timerLabel = document.getElementById('timer-label');
    if (timerBar) { timerBar.style.transition = 'none'; timerBar.style.width = '100%'; }

    let remaining = GAME_DURATION / 1000;
    if (timerLabel) timerLabel.textContent = remaining + 'সে';

    countdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0 || !gameActive) { clearInterval(countdownInterval); return; }

        // Animate timer bar
        if (timerBar) {
            timerBar.style.transition = 'width 0.9s linear';
            timerBar.style.width = (remaining / (GAME_DURATION / 1000) * 100) + '%';
            if (remaining <= 5) timerBar.style.background = '#e94560';
            else if (remaining <= 10) timerBar.style.background = 'linear-gradient(90deg,#f59e0b,#e94560)';
        }
        if (timerLabel) timerLabel.textContent = remaining + 'সে';

        // Hint text
        const hint = document.getElementById('kick-hint');
        if (remaining <= 10) {
            hint.textContent = isTouchDevice()
                ? `⏱ ${remaining} সেকেন্ড বাকি! তাড়াতাড়ি ট্যাপ করো! 🦵`
                : `⏱ ${remaining} সেকেন্ড বাকি! তাড়াতাড়ি লাত্তাও! 🦵`;
            hint.style.opacity = '1';
            hint.style.color = remaining <= 5 ? '#e94560' : '#f59e0b';
        }
    }, 1000);
}

function endGame() {
    gameActive = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (resetTimer) clearTimeout(resetTimer);
    if (countdownInterval) clearInterval(countdownInterval);

    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score;
        localStorage.setItem('kickHighScore', highScore);
    }

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-combo').textContent = 'x' + maxCombo;
    document.getElementById('final-high').textContent = highScore;
    document.getElementById('new-record').classList.toggle('hidden', !isNewRecord);

    const tiers = [
        [3000, '🏆', 'আরে! হাদারাম পরাজিত!'],
        [1500, '🦵', 'বাপ রে বাপ! লাথির উস্তাদ!'],
        [500, '👊', 'মন্দ না ভাই!'],
        [100, '👍', 'ভালোই তো বর্খাস্ত!'],
        [0, '😅', 'আরো জোরে মারতে থাকো ভাই!'],
    ];
    let emoji = '😅', title = 'আরো জোরে মারতে থাকো ভাই!';
    for (const [thresh, e, t] of tiers) {
        if (score >= thresh) { emoji = e; title = t; break; }
    }
    const emojiEl = document.getElementById('result-emoji');
    if (emojiEl) emojiEl.textContent = emoji;
    document.getElementById('result-title').textContent = title;

    // Confetti on new record
    if (isNewRecord) spawnConfetti();

    showScreen('gameover');
}

function spawnConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#e94560', '#ffd700', '#3b82f6', '#10b981', '#a855f7', '#f97316'];
    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.setProperty('--drift', (Math.random() * 200 - 100) + 'px');
        const dur = 1.8 + Math.random() * 2.2;
        const delay = Math.random() * 1.5;
        piece.style.animationDuration = dur + 's';
        piece.style.animationDelay = delay + 's';
        container.appendChild(piece);
    }
    setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// Show menu at start
showScreen('menu');
