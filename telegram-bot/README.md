# Telegram booking bot for Антицель

This is a separate Cloudflare Worker scaffold. It does not modify the live website files or the existing `antitsel-site` Worker.

## What it currently does
- Responds to `/start` and shows a menu.
- Shows the current service prices.
- Explains what information to include in a booking request.
- Protects the webhook with Telegram's secret-token header.

## Required Cloudflare Worker secrets/variables
Set these in the Cloudflare dashboard for the separate Worker `antitsel-telegram-bot`:

- `TELEGRAM_BOT_TOKEN` — token from BotFather (secret).
- `WEBHOOK_SECRET` — a random 32+ character secret using only letters, numbers, underscores, and hyphens.
- `SETUP_KEY` — another random secret used only for one-time setup.
- `WORKER_URL` — the full HTTPS URL of this Worker, without a trailing slash, e.g. `https://antitsel-telegram-bot.<your-subdomain>.workers.dev`.
- `ADMIN_CHAT_ID` — Zulfiya's Telegram chat ID to receive incoming messages and booking requests. Set this only after we verify the correct chat ID.

## Deploy and register the webhook
1. Create a new Cloudflare Worker and connect this repository's branch `telegram-bot-setup`, with the root directory set to `telegram-bot`; alternatively deploy this directory using Wrangler.
2. Add the secrets/variable values above in the Worker settings. Never put the bot token into this repository.
3. Send a POST request to `/setup` with the header `x-setup-key: <your SETUP_KEY>`. The Worker registers its `/webhook` URL with Telegram.
4. Open the bot in Telegram and send `/start`.

## Important limitation
Messages sent to the bot are forwarded to `ADMIN_CHAT_ID` only after that variable is configured. This version does not store requests or collect structured form fields; users should include their name, requested service, preferred days/time and contact in one message. Test it with your own account before sharing it publicly.
