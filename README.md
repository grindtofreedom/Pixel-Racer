# PIXEL RACER

A complete top-down pixel-art racing game built with HTML5 Canvas, CSS and
vanilla JavaScript (ES6 classes). No build step, no dependencies, no external
assets — every sprite and sound is generated at runtime.

## Run it

It runs straight from the filesystem because it uses plain `<script>` tags
(not ES modules), so there are no CORS restrictions.

**Option A — double-click**
Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

**Option B — local server (recommended)**

```bash
cd pixel-racer
python3 -m http.server 8000
# then open http://localhost:8000
```

From the menu pick **1 PLAYER** or **2 PLAYERS** (shared-keyboard split-screen).
Audio unlocks on your first key press, per browser autoplay rules.

## Controls

**1 Player** — use either WASD or the arrow keys:

| Key            | Action            |
| -------------- | ----------------- |
| `W` / `↑`      | Accelerate        |
| `S` / `↓`      | Brake / reverse   |
| `A` / `←`      | Steer left        |
| `D` / `→`      | Steer right       |
| `Space`        | Handbrake (drift) |

**2 Players** (one keyboard, top = P1, bottom = P2):

| Player   | Drive / steer        | Handbrake / drift |
| -------- | -------------------- | ----------------- |
| Player 1 | `W` `A` `S` `D`      | `Left Shift`      |
| Player 2 | `↑` `←` `↓` `→`      | `Right Shift`     |

Menu shortcuts: `Enter` / `1` start a solo race, `2` starts split-screen.
On the finish screen, `Enter` races again.

On a phone (or in Telegram) solo mode shows touch controls: tap-and-hold the
**◀** / **▶** buttons in the bottom corners to steer, the car auto-accelerates,
and hold the centre **DRIFT** button to slide. Multi-touch is supported, so you
can steer and drift at the same time.

## Run it as a Telegram bot (Mini App)

The game ships with a tiny zero-dependency bot in `bot/`. The flow is:
**bot opens the game as a Telegram Mini App → you play → the finish screen
sends your result back to the bot.**

You need three things: a bot token, an HTTPS URL that serves the game, and
Node 18+ to run the bot.

### 1. Create the bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, pick a name and a username → copy the **token**.

### 2. Host the game over HTTPS

Telegram will not load a Mini App from `http://` or `localhost` — it must be a
public `https://` URL. Pick one:

- **GitHub Pages (free, easiest):** push the `pixel-racer/` files to a repo,
  then *Settings → Pages → Deploy from branch → main / root*. Your URL becomes
  `https://<user>.github.io/<repo>/`.
- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop the folder, copy the
  given URL.
- **Quick test from your machine:** run `node server.js` (serves on `:8765`),
  then expose it with a tunnel, e.g. `npx ngrok http 8765`, and use the
  printed `https://…ngrok…` URL. (Temporary — changes each run.)

That public URL is your `GAME_URL` (point it at the folder containing
`index.html`; keep the trailing slash).

### 3. Run the bot

```bash
cd pixel-racer
BOT_TOKEN="123456:AA...your-token..." \
GAME_URL="https://your-name.github.io/pixel-racer/" \
node bot/bot.js
```

(Or copy `bot/.env.example` to set the values, then `cd bot && npm start`.)
The bot uses long-polling, so it needs no inbound HTTPS itself — just keep the
process running. For 24/7 hosting deploy it to Railway, Render, Fly.io or any
small VPS and set the same two environment variables.

### 4. Play

Open your bot in Telegram, send `/start`, and tap **🏎 Play Pixel Racer**.
After the race, tap **ОТПРАВИТЬ РЕЗУЛЬТАТ** on the finish screen and the bot
replies with your placing.

> Note: Telegram only delivers the result when the Mini App is opened from the
> **reply-keyboard "Play" button** (which `bot.js` sends). The chat menu button
> (🏎 Play, top-left of the chat) launches the game too, but does not relay the
> result back.

## Features

- Arcade car physics with forward/lateral velocity, grip and handbrake drift
- 1-player and 2-player split-screen (shared keyboard) modes
- Telegram Mini App ready: on-screen ◀ / ▶ / DRIFT touch buttons + result bot
- AI opponents following the track waypoints with per-car skill variation
- Collision detection: car-vs-car (momentum exchange) and solid track walls
- 3-lap race with ordered checkpoints, live timer and position ranking
- Animated start countdown and a results/finish screen
- Camera that smoothly follows the player, plus a live minimap
- Retro pixel rendering with runtime-generated car/road/grass sprites
- Web Audio API engine note, drift hiss, countdown beeps, crash and lap sounds

## Project structure

```
pixel-racer/
├── index.html              # markup + overlays + script load order
├── README.md
├── css/
│   └── style.css           # UI / overlay / results styling
└── js/
    ├── utils.js            # math & geometry helpers
    ├── Input.js            # keyboard -> normalized controls
    ├── AudioManager.js     # Web Audio synthesis (engine + SFX)
    ├── SpriteFactory.js    # procedural car / road / grass sprites
    ├── Track.js            # circuit, road rendering, walls, checkpoints
    ├── Camera.js           # smoothing follow camera
    ├── Car.js              # base physics, laps, collisions, ranking
    ├── PlayerCar.js        # human-controlled car
    ├── AICar.js            # waypoint-following opponent
    ├── Minimap.js          # overview widget
    ├── HUD.js              # timer / lap / position / speedo / countdown
    ├── Game.js             # state machine, loop, collisions, orchestration
    └── main.js             # bootstrap & viewport wiring
```

## Architecture notes

- **OOP / inheritance:** `PlayerCar` and `AICar` extend a shared `Car` base
  that owns all physics and race logic; subclasses only provide control input.
- **Fixed-step physics:** `Game` integrates at a fixed 120 Hz accumulator for
  stable, frame-rate-independent handling, while rendering runs per frame.
- **No assets:** `SpriteFactory` draws to offscreen canvases; `AudioManager`
  synthesizes all sound — the game is fully self-contained.
