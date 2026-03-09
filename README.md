# 👟 হাদারামের পোঁদে লাথি! — Kick Your Buddy

> A fast-paced Bengali action game built entirely with **HTML5 Canvas** — zero external libraries, zero frameworks, zero build tools. Pure vanilla fun.

🔴 **[▶ Play Live Now](https://mahfujul-01726.github.io/kickAss/)**

---

## 🎮 About the Game

You are the **Kicker** — a red-jersey wearing guy with a serious attitude. Your target is **হাদারাম** — a chubby guy in a blue kurta and off-white pajamas with glasses. Your mission: kick him as hard and as often as possible within **30 seconds**, build up a combo multiplier, and rack up the highest score you can.

Score increases every single frame হাদারাম stays airborne. Kick again mid-flight to keep the combo going. Watch his face change — shocked on impact, crying on landing, dizzy after enough bounces.

---

## ✨ Features

- ⏱ **30-second timed rounds** — every second counts
- ⚡ **Combo multiplier up to ×10** — each consecutive kick before landing increases the multiplier; resets to ×1 on final landing
- 🌟 **Passive airborne scoring** — `score += combo` every game frame হাদারাম is flying
- 😂 **4 dynamic facial expressions** — `normal`, `shocked` (on kick), `crying` (on landing), `dizzy` (after repeated bounces)
- 💥 **Particle effects** — 22-particle impact burst + 6 star sparks on kick, bounce dust on each ground hit
- 💬 **Floating feedback text** — Bengali hit labels ("ধাঁই!", "তুড়োম!", "আউচ!" etc.) float up from impact points
- 🔊 **Procedural Web Audio sounds** — kick thud (low-pass noise burst + sine oscillator) and a multi-pulse crying wail (sawtooth + bandpass filter)
- 📷 **Animated preview canvas** — menu screen shows a looping kick animation cycling through all 7 kick frames
- 🌍 **Parallax scrolling** — camera follows হাদারাম mid-flight; stars parallax at 10% of camera speed; lerps back on landing
- 🌙 **Crescent moon + star field** — 80 randomised background stars with per-star alpha and radius
- 📱 **Touch + keyboard + click input** — Tap, Space, ↑ Arrow all work; touch events call `preventDefault()` to stop scroll
- 🏆 **Persistent high score** — stored in `localStorage` under key `kickHighScore`
- 🎨 **Neon arcade dark theme** — CSS custom properties, glassmorphism cards, animated gradient blobs
- 📳 **Screen shake on kick** — 12px intensity, 200ms duration, fades out over time
- ⏸ **Pause / Resume** — Escape key or pause button; preserves all game state
- 🎉 **Confetti on new record** — 80 CSS-animated confetti pieces on a new high score
- ♿ **Accessible** — `aria-label` on all interactive buttons

---

## 🕹️ How to Play

| Input | Action |
|-------|--------|
| `Click` on canvas | Kick হাদারাম |
| `Tap` (mobile) | Kick হাদারাম |
| `Spacebar` or `↑ Arrow` | Kick হাদারাম |
| `Escape` | Pause / Resume |

**Scoring tip:** Each kick while হাদারাম is already airborne increments the combo. The combo multiplier applies to _every frame_ of flight — a ×10 combo while হাদারাম soars high is worth massive points.

**Result tiers** (shown on game over screen):

| Score | Message |
|-------|---------|
| ≥ 3000 | 🏆 আরে! হাদারাম পরাজিত! |
| ≥ 1500 | 🦵 বাপ রে বাপ! লাথির উস্তাদ! |
| ≥ 500  | 👊 মন্দ না ভাই! |
| ≥ 100  | 👍 ভালোই তো বর্খাস্ত! |
| < 100  | 😅 আরো জোরে মারতে থাকো ভাই! |

---

## 📁 Project Structure

```
kickAss/
├── index.html    # All game screens (menu, how-to, game, pause, game over)
├── game.js       # Entire game — state machine, physics, rendering, audio, input
├── style.css     # Neon arcade UI theme, screen transitions, confetti animation
└── README.md     # This file
```

---

## 🏗️ Architecture

### Game State Machine (`GS`)

The game uses a five-state finite state machine stored in the `state` variable:

| State | Description |
|-------|-------------|
| `IDLE` | হাদারাম is standing next to the kicker, waiting for input |
| `KICKING` | 7-frame kick swing animation is playing |
| `FLYING` | হাদারাম is airborne; physics and scoring active |
| `LANDED` | হাদারাম has settled on the ground; brief pause before reset |
| `RETURNING` | হাদারাম waddling back to start position via lerp |

### Physics Constants

| Constant | Value | Effect |
|----------|-------|--------|
| `GRAVITY` | `0.55` | Added to `vy` every frame |
| `GROUND_Y_RATIO` | `0.72` | Ground sits at 72% of canvas height |
| `BOUNCE_DAMPING` | `0.5` | `vy` multiplied by this on each bounce |
| `BOUNCE_FRICTION` | `0.82` | `vx` multiplied by this on each bounce |
| `MIN_BOUNCE_V` | `3` | Below this `vy`, হাদারাম settles instead of bouncing |

### Kick Launch

On impact (kick frame 4 of 7), `launchFriend()` fires:
- **Power:** `14 + random(0–6)` units
- **Angle:** `−(π/2.2 + random(0–0.25))` — approximately 65–75° upward
- **`vx`:** `power × cos(angle) × 0.55` — intentionally low horizontal component for height
- **`vy`:** `power × sin(angle) × 1.3` — boosted vertical for big airtime
- **Squash/stretch:** `squash = 1.5`, `stretch = 0.6` on launch; recovers at 18% per frame

### Screen Management

All 5 screens (`menu`, `howto`, `game`, `pause`, `gameover`) are DOM elements. `showScreen(name)` removes `.active` from all and adds it to the target. The pause overlay keeps both `pause` and `game` screens active simultaneously.

### Audio System

All sounds are synthesised at runtime using the **Web Audio API** — no audio files are loaded:

- **Kick sound:** A low-pass filtered noise burst (0.22s) layered with a sine oscillator sweeping 200 Hz → 55 Hz (0.14s)
- **Cry sound:** Four sawtooth "WAAH" pulses at 440/400/430/370 Hz through a bandpass filter (900 Hz, Q=2.5), plus a sustained triangle hum at 220→180 Hz

The `AudioContext` is lazily created on first interaction and resumed if suspended (required by browser autoplay policy).

### Rendering Pipeline (per frame)

1. Apply screen shake offset (`ctx.translate(sx, sy)`)
2. Draw background — sky gradient, parallax stars, crescent moon, ground, floor tiles
3. Apply camera transform (`ctx.translate(-camX, 0)`)
4. Draw kicker (7-frame animated sprite built with `ctx` paths)
5. Draw হাদারাম (with squash/stretch scale and rotation angle)
6. Draw particles
7. Restore camera transform
8. Draw floating texts (screen-space, no camera offset)
9. Draw combo flash overlay if combo > 1 and airborne

---

## 🎨 Visual Design

### Colour Palette

| Variable | Hex | Usage |
|----------|-----|-------|
| `--red` | `#e94560` | Primary accent, ground glow, timer danger |
| `--blue` | `#1a4fa0` | হাদারাম's kurta |
| `--gold` | `#f59e0b` | Combo text, timer warning |
| `--bg` | `#080d1a` | Page background |
| `--card` | `rgba(12,22,48,0.88)` | Glassmorphism UI cards |

### Characters

**Kicker** — drawn entirely with `ctx` path commands each frame:
- Warm tan skin (`#f0c090`), bright red jersey (`#cc2244`), dark navy pants (`#1e2d4a`), black shoes with white lace
- Angry furrowed brows, side-parted hair (`#1c1008`)
- 7 kick frames with per-frame leg angles, lunge offsets, arm counter-swing, and shoe toe rotation

**হাদারাম** — scaled at `FAT = 1.42` for the chubby proportions:
- Medium-dark brown skin (`#8B5E3C`), deep blue kurta (`#1a4fa0`) with fabric dots and 4 buttons, off-white pajama pants (`#edeae4`), sandals
- Thin metal glasses with tinted lenses and glare highlight
- Wristwatch on left arm
- Double chin, chubby cheek flush blush
- Prominent two-cheek butt geometry (intentional — that's the kick target)

---

## 🛠️ Tech Stack

| Technology | Usage |
|------------|-------|
| **HTML5 Canvas 2D API** | All game rendering — characters, background, particles, effects |
| **Web Audio API** | 100% procedural kick and cry sound synthesis |
| **CSS3** | UI layout, glassmorphism cards, blob animations, confetti keyframes |
| **Vanilla JavaScript (ES6+)** | Game loop (`requestAnimationFrame`), physics, state machine, input |
| **localStorage** | High score persistence (`kickHighScore` key) |
| **Google Fonts** | Bangers (arcade headings) + Exo 2 (UI text) |
| **GitHub Pages** | Live deployment from `main` branch |

---

## 🚀 Run Locally

No build step, no `npm install`, no dependencies — just clone and open:

```bash
git clone https://github.com/Mahfujul-01726/kickAss.git
cd kickAss

# Open directly in browser:
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

Or serve it with any static server:

```bash
npx serve .               # Node.js
python -m http.server     # Python 3
```

---

## 🌐 Live Deployment

Deployed on **GitHub Pages** — auto-rebuilds on every push to `main`.

**Live URL:** https://mahfujul-01726.github.io/kickAss/

To push updates:

```bash
git add .
git commit -m "describe your change"
git push
```

GitHub Pages typically reflects changes within **1–2 minutes**.

---

## 📸 Screenshots

| Menu Screen | Game Screen | Game Over |
|:-----------:|:-----------:|:---------:|
| Animated preview canvas, high score display | HUD (score, combo, best), timer bar, canvas | Final score, best combo, result tier, confetti on record |

---

## 👨‍💻 Author

**Mahfujul** — [@Mahfujul-01726](https://github.com/Mahfujul-01726)

---

## 📄 License

Open source — feel free to fork, modify, and share!
