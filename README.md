# 👟 শুয়োরের পোঁদে লাথি! — Kick Your Buddy

> A fast-paced Bengali action game built entirely with HTML5 Canvas — no libraries, no frameworks, just pure fun!

🔴 **[▶ Play Live Now](https://mahfujul-01726.github.io/kickAss/)**

---

## 🎮 About the Game

Kick the buddy as hard as you can, build combos, and smash the high score — all within **30 seconds**! Watch the character's hilarious facial expressions change with every kick, bounce, and landing.

---

## ✨ Features

- ⚡ **Combo multiplier** — chain kicks to reach up to **×10** combo
- 🌟 **Score while flying** — score keeps increasing as long as the buddy is airborne
- 😂 **Dynamic expressions** — shocked, crying, dizzy faces on every kick and landing
- 💥 **Particle effects** — impact sparks, bouncing dust, floating feedback text
- 🔊 **Web Audio API sounds** — procedurally generated kick thud and crying wail
- 📱 **Fully responsive** — works on desktop, tablet, and mobile (touch supported)
- 🏆 **Persistent high score** — saved in `localStorage` across sessions
- 🎨 **Neon arcade dark theme** — animated background blobs, glassmorphism UI
- ⏸ **Pause / Resume** — full pause screen support
- 🎉 **Confetti on new record** — celebrate when you beat your best score

---

## 🕹️ How to Play

| Input | Action |
|-------|--------|
| `Click` / `Tap` | Kick the buddy |
| `Spacebar` / `↑ Arrow` | Kick the buddy |
| `Escape` | Pause / Resume |

- You have **30 seconds** — kick as many times as possible
- Keep kicking while the buddy is in the air to grow your **combo multiplier**
- The longer the buddy stays airborne, the more points you rack up
- Land the highest score possible before time runs out!

---

## 📁 Project Structure

```
kickAss/
├── index.html   # Game markup — all screens (menu, game, pause, game over)
├── game.js      # Game logic — physics, rendering, audio, input, state machine
├── style.css    # Styling — neon arcade theme, animations, responsive layout
└── README.md    # This file
```

---

## 🛠️ Tech Stack

| Technology | Usage |
|------------|-------|
| **HTML5 Canvas** | All game rendering (characters, background, particles) |
| **Web Audio API** | Procedural kick and cry sound effects |
| **CSS3** | UI screens, glassmorphism cards, animations |
| **Vanilla JavaScript** | Game loop, physics engine, state machine |
| **localStorage** | Persistent high score storage |
| **GitHub Pages** | Free live hosting |

---

## 🚀 Run Locally

No build tools or dependencies needed — just open the file:

```bash
git clone https://github.com/Mahfujul-01726/kickAss.git
cd kickAss
# Open index.html in your browser
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

---

## 🌐 Live Deployment

The game is deployed on **GitHub Pages** and updates automatically every time changes are pushed to the `main` branch.

**Live URL:** https://mahfujul-01726.github.io/kickAss/

To deploy your own changes:

```bash
git add .
git commit -m "your change description"
git push
```

GitHub Pages rebuilds the site automatically within **1–2 minutes**.

---

## 📸 Screenshots

| Menu Screen | Game Screen | Game Over |
|:-----------:|:-----------:|:---------:|
| Main menu with animated preview canvas | Live gameplay with HUD and timer bar | Results with combo stats and confetti |

---

## 👨‍💻 Author

**Mahfujul** — [@Mahfujul-01726](https://github.com/Mahfujul-01726)

---

## 📄 License

This project is open source — feel free to fork, modify, and share!
