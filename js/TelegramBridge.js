'use strict';

/**
 * Thin wrapper around the Telegram Mini App SDK (telegram-web-app.js).
 * Degrades gracefully to a no-op when the game runs outside Telegram (e.g.
 * opened directly in a browser), so the same build works everywhere.
 */
class TelegramBridge {
  constructor() {
    this.tg = (window.Telegram && window.Telegram.WebApp) || null;

    // The SDK creates a WebApp object even in a plain browser; a real Telegram
    // host reports a known platform (and usually initData). Use that to tell
    // genuine Mini App sessions apart from standalone browser play.
    this.available =
      !!this.tg &&
      typeof this.tg.platform === 'string' &&
      this.tg.platform !== 'unknown';

    if (this.available) {
      try {
        this.tg.ready();
        this.tg.expand();
        // Stop a vertical swipe (used here for steering) from closing the app.
        if (typeof this.tg.disableVerticalSwipes === 'function') {
          this.tg.disableVerticalSwipes();
        }
        if (typeof this.tg.setHeaderColor === 'function') this.tg.setHeaderColor('#0c0e14');
        if (typeof this.tg.setBackgroundColor === 'function') this.tg.setBackgroundColor('#0c0e14');
      } catch (_) {
        /* ignore SDK quirks across versions */
      }
    }
  }

  /** True when actually hosted inside the Telegram client. */
  get inTelegram() {
    return this.available;
  }

  /** User's display name, if Telegram provided it. */
  get userName() {
    try {
      const u = this.tg.initDataUnsafe && this.tg.initDataUnsafe.user;
      return u ? u.first_name : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Send the race result back to the bot. Only works when the Mini App was
   * opened via a reply-keyboard web_app button; Telegram delivers it as a
   * `web_app_data` message and closes the app.
   */
  reportResult(result) {
    if (!this.available) return false;
    try {
      this.tg.sendData(JSON.stringify(result));
      return true;
    } catch (_) {
      return false;
    }
  }
}
