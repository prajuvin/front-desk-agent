# ADR-001: How Front Desk answers customers

**Status:** Accepted
**Date:** 2026-09-23
**Deciders:** Praju

## Context

Front Desk answers customer messages for a small service business (a salon, a florist) when the owner is busy. Two things matter more than anything else:

1. It must never make things up: a wrong price or a promised booking costs the owner money and trust.
2. What the AI can't handle has to reach the owner, or the tool only hides lost customers.

It also has to be cheap to run for a business with a few dozen messages a day, and simple enough for the owner to set up.

## Decision

- A single serverless endpoint, `POST /api/chat`, sends the owner's business details and the conversation to a small, fast Claude model (`claude-haiku-4-5` by default, changeable with `CLAUDE_MODEL`).
- The model must reply as JSON: `{reply, outcome}`, where outcome is `answered`, `booking`, or `needs_owner`. The server checks it. If the AI is down or breaks the format, a keyword-rules answer is used instead and the conversation is handed to the owner.
- Bookings and hand-offs are POSTed to the owner's own webhook (`OWNER_WEBHOOK_URL`), so they arrive through Zapier, Make, Slack, Discord, or email, whichever the owner already uses.
- With no API key, the same page still works using keyword rules, clearly labelled.

## Options considered

### A: Serverless endpoint plus owner webhook (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Low: one function, no database |
| Cost | Hosting free on Vercel's hobby tier; AI cost per message is small with a Haiku-class model |
| Scalability | Fine for one business per deployment |
| Familiarity | High: plain Node and HTML |

Pros: nothing to maintain; hand-offs reach the owner through tools they already use. Cons: no conversation history saved on the server; one deployment per business.

### B: Full app with login and database (Next.js and Supabase)

Pros: owners edit details themselves, conversations are stored, and one deployment serves many businesses. Cons: several times the build effort before a single real business has used it.

### C: Off-the-shelf chatbot builder

Pros: fastest to launch. Cons: monthly fees, less control over "never invent a price", and nothing of your own to show.

## Trade-off analysis

A proves the one thing that matters, whether a real business gets fewer missed customers, with the least to build. B is the right next step once one business has used A for two weeks and wants to keep it.

## Consequences

- Easier: set it up for a client in an afternoon by editing `business.json` and three settings.
- Harder: the owner can't edit details without a redeploy; the conversation log only exists on the page and in webhook messages.
- Risks to watch:
  - **Cost abuse:** anyone can send messages. Messages are capped at 500 characters, 8 turns, and 400 output tokens, but there is no rate limit yet. Add one before public launch.
  - **Demo mode** (`DEMO_MODE=true`) lets the page send its own business details. Use it only for the public demo, never on a client's live site.
  - **Model ID:** confirm `claude-haiku-4-5` (or the current small model) against Anthropic's model list when setting the key.

## Action items

1. [x] Endpoint, JSON check, safe fallback, owner webhook, tests (10 unit, 3 browser modes)
2. [ ] Add a rate limit
3. [ ] Deploy to your own Vercel account with an Anthropic API key
4. [ ] Two-week trial with one real business: count questions answered, bookings passed on, and wrong answers
