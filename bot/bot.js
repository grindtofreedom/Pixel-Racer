'use strict';

/**
 * Pixel Racer — Telegram bot (zero dependencies, Node 18+).
 *
 * It opens the HTML5 game as a Telegram Mini App and receives the player's
 * result when they tap "ОТПРАВИТЬ РЕЗУЛЬТАТ" on the finish screen.
 *
 * Required environment variables:
 *   BOT_TOKEN  - token from @BotFather
 *   GAME_URL   - public HTTPS url that serves index.html (e.g. GitHub Pages)
 *
 * Run:  BOT_TOKEN=123:abc GAME_URL=https://you.github.io/pixel-racer/ node bot/bot.js
 *
 * Note: Telegram only delivers `web_app_data` (the result) when the Mini App
 * is opened from a *reply-keyboard* web_app button — which is exactly what the
 * "Play" button below uses. The chat menu button is a convenience shortcut.
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const GAME_URL = process.env.GAME_URL;

if (!BOT_TOKEN) {
  console.error('ERROR: set BOT_TOKEN (from @BotFather).');
  process.exit(1);
}
if (!GAME_URL || !GAME_URL.startsWith('https://')) {
  console.error('ERROR: set GAME_URL to the public HTTPS url of the game.');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function api(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) console.error(`API ${method} failed:`, data.description);
  return data.result;
}

/** Reply keyboard whose button opens the Mini App (enables result delivery). */
function playKeyboard() {
  return {
    keyboard: [[{ text: '🏎 Play Pixel Racer', web_app: { url: GAME_URL } }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  // Result coming back from the Mini App.
  if (msg.web_app_data) {
    let r = {};
    try { r = JSON.parse(msg.web_app_data.data); } catch (_) {}
    const place = r.place || (r.placed ? `${r.placed}` : 'finished');
    const time = r.time ? ` — ${r.time}` : '';
    const medal = r.placed === 1 ? '🥇' : r.placed === 2 ? '🥈' : r.placed === 3 ? '🥉' : '🏁';
    await api('sendMessage', {
      chat_id: msg.chat.id,
      text: `${medal} You finished ${place}${time}!\nTap Play to race again.`,
      reply_markup: playKeyboard(),
    });
    return;
  }

  // /start (or any text) -> send the play button.
  if (msg.text) {
    await api('sendMessage', {
      chat_id: msg.chat.id,
      text:
        '🏎 *PIXEL RACER*\n\n' +
        'Top-down arcade racing. Swipe to steer, tap *DRIFT* to slide.\n' +
        'Tap the button below to play!',
      parse_mode: 'Markdown',
      reply_markup: playKeyboard(),
    });
  }
}

async function setup() {
  // Persistent chat menu button that also opens the game.
  await api('setChatMenuButton', {
    menu_button: { type: 'web_app', text: '🏎 Play', web_app: { url: GAME_URL } },
  });
  await api('setMyCommands', {
    commands: [{ command: 'start', description: 'Play Pixel Racer' }],
  });
}

async function main() {
  await setup();
  console.log('Pixel Racer bot is running.');
  console.log('Game URL:', GAME_URL);

  let offset = 0;
  // Long-polling loop.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = (await api('getUpdates', { offset, timeout: 30 })) || [];
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u);
      }
    } catch (err) {
      console.error('poll error:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main();
