# IMPERION Publisher MVP

Prototype bundle is stored on Google Drive: https://drive.google.com/file/d/1SVSjXaVJ7I_gvm-ofyIl_gjin87T4Ihc/view

Includes Python publisher.py, a sample post, dependencies, README and gitignore. Tested with local Python dry run on 2026-10-16.

Supported API adapters: Telegram bot, Facebook Page, Instagram Professional photos, YouTube private uploads. Manual review handoffs: main personal Facebook profile, WhatsApp groups, TikTok. These manual channels must not be misrepresented as auto-posted.

SECURITY: this repo is public; do not commit tokens, user credentials, contact databases, or private CRM. No remote deployment or scheduler activated. Separate z.s. grant event channels from personal commercial services.

To activate: owner must grant target-channel rights and configure credentials in a secure runtime, test each with a draft post, then implement a single scheduler, retries, final status verification, and review gate.
