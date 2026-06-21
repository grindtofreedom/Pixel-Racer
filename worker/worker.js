'use strict';

/**
 * Pixel Racer — Telegram bot as a Cloudflare Worker (webhook mode).
 *
 * Unlike the long-polling bot in ../bot/bot.js, this runs serverless: Telegram
 * pushes each update to this Worker over HTTPS, so there is no always-on
 * process to pay for. It fits comfortably in Cloudflare's free tier.
 *
 * Bindings (set with wrangler):
 *   BOT_TOKEN       - secret, token from @BotFather   (wrangler secret put BOT_TOKEN)
 *   WEBHOOK_SECRET  - secret, random string           (wrangler secret put WEBHOOK_SECRET)
 *   GAME_URL        - plain var in wrangler.toml, the public HTTPS game URL
 *
 * Routes:
 *   POST /webhook        - Telegram delivers updates here (verified by header)
 *   GET  /setup?key=...  - one-time: registers the webhook + menu button + commands
 *   GET  /               - health check
 */

function tgApi(token, method, params) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then((r) => r.json());
}

/** Reply keyboard whose button opens the Mini App (enables result delivery). */
function playKeyboard(gameUrl) {
  return {
    keyboard: [[{ text: '🏎 Play Pixel Racer', web_app: { url: gameUrl } }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function handleUpdate(update, env) {
  const msg = update.message;
  if (!msg) return;
  const token = env.BOT_TOKEN;
  const gameUrl = env.GAME_URL;

  // Result coming back from the Mini App finish screen.
  if (msg.web_app_data) {
    let r = {};
    try { r = JSON.parse(msg.web_app_data.data); } catch (_) {}
    const place = r.place || (r.placed ? `${r.placed}` : 'finished');
    const time = r.time ? ` — ${r.time}` : '';
    const medal = r.placed === 1 ? '🥇' : r.placed === 2 ? '🥈' : r.placed === 3 ? '🥉' : '🏁';
    await tgApi(token, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `${medal} You finished ${place}${time}!\nTap Play to race again.`,
      reply_markup: playKeyboard(gameUrl),
    });
    return;
  }

  // /start (or any text) -> send the play button.
  if (msg.text) {
    await tgApi(token, 'sendMessage', {
      chat_id: msg.chat.id,
      text:
        '🏎 *PIXEL RACER*\n\n' +
        'Top-down arcade racing. Hold ◀ ▶ to steer, tap *DRIFT* to slide.\n' +
        'Tap the button below to play!',
      parse_mode: 'Markdown',
      reply_markup: playKeyboard(gameUrl),
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // One-time setup: register the webhook, the chat menu button and commands.
    if (url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const out = {};
      out.setWebhook = await tgApi(env.BOT_TOKEN, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      });
      out.setChatMenuButton = await tgApi(env.BOT_TOKEN, 'setChatMenuButton', {
        menu_button: { type: 'web_app', text: '🏎 Play', web_app: { url: env.GAME_URL } },
      });
      out.setMyCommands = await tgApi(env.BOT_TOKEN, 'setMyCommands', {
        commands: [{ command: 'start', description: 'Play Pixel Racer' }],
      });
      return new Response(JSON.stringify(out, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Telegram webhook deliveries.
    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      let update;
      try { update = await request.json(); } catch (_) { return new Response('bad request', { status: 400 }); }
      // Respond fast; finish the Telegram API calls in the background.
      ctx.waitUntil(handleUpdate(update, env));
      return new Response('ok');
    }

    return new Response('Pixel Racer bot is running (webhook mode).');
  },
};
