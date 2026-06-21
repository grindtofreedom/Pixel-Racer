# Minimal image for the zero-dependency Telegram bot (long-polling worker).
FROM node:20-alpine
WORKDIR /app

# The bot has no npm dependencies, so we only need its source.
COPY bot/ ./bot/

# BOT_TOKEN and GAME_URL are provided at runtime via `fly secrets set`.
CMD ["node", "bot/bot.js"]
