# KADH Collective

Modest fashion ecommerce — abayas, made in Kuala Lumpur, shipped worldwide.

Live site: [kadhcollective.com](https://kadhcollective.com)

## Stack

| Layer | Tech |
|---|---|
| Frontend | Static HTML + vanilla JS, hosted on Vercel |
| Backend | Supabase (Postgres + Edge Functions on Deno) |
| Payments | Stripe Checkout (Card + FPX + GrabPay + Apple/Google Pay) |
| Email | Resend (transactional receipts) |
| Domain | kadhcollective.com on GoDaddy DNS → Vercel |

## File map

```
index.html                        — storefront (landing, cart, checkout, PDP, success, track, about, community)
admin.html                        — admin panel at /admin (Supabase Auth)
config.js                         — static brand copy (hero, about, community, social, courier URLs)
sidebar.js, sidebar.css           — admin sidebar utilities
vercel.json                       — Vercel routing (rewrites + headers + redirects)
robots.txt                        — search-engine rules
favicon.svg                       — site icon
.gitignore, .env.example          — env hygiene
supabase/migrations/*.sql         — versioned DB migrations (run manually via SQL Editor)
supabase/functions/<name>/index.ts — Deno edge functions (deploy via dashboard)
scripts/email.js                  — legacy receipt template (now mirrored in send-receipt edge fn)
```

## Edge functions

| Function | Purpose | Triggered by |
|---|---|---|
| `send-receipt` | Email order receipt via Resend | Stripe webhook + admin "Resend Receipt" button |
| `create-checkout-session` | Build Stripe Checkout Session | Storefront `placeOrder()` |
| `stripe-webhook` | Verify signature, mark order paid, trigger receipt | Stripe (live + test) |
| `refresh-fx-rates` | Pull latest currency rates → site_settings | Daily Supabase Cron + admin "Refresh" button |

## Database tables (key ones)

- `products` — catalogue (id, name, price, stock_count, in_stock, is_visible, images, …)
- `orders` — purchases (order_ref, status, items[], stripe_session_id, paid_at, …)
- `site_settings` — admin-editable config (key/value JSONB, RLS enforces public/private)
- `journal_posts` — Community page articles
- `events` — Community page gatherings (upcoming + past)
- `newsletter_subscribers` — community page email signups

## Local edits → live site

The current workflow is **edit local files → upload to GitHub via web UI → Vercel auto-deploys**.

For a smoother local-git workflow, install [GitHub Desktop](https://desktop.github.com/) and clone the repo.

## Required secrets (Supabase Edge Function Secrets)

Set at `dashboard.supabase.com/project/<ref>/functions/secrets`:

- `STRIPE_SECRET_KEY` — Stripe live secret key
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret from Stripe
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-provided by Supabase

Resend API key + EasyParcel keys are stored in the `site_settings` table (admin-managed).

## Stripe webhook URL

Register at `dashboard.stripe.com/webhooks`:

```
https://nlgavsmgnxrkrwbyonxr.supabase.co/functions/v1/stripe-webhook
```

Subscribe to: `checkout.session.completed`

## Daily FX cron

Configure in Supabase Dashboard → Database → Cron:

- **Schedule:** `0 1 * * *` (01:00 UTC = 09:00 MYT)
- **Function:** `refresh-fx-rates`
- **Method:** POST
