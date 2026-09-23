# Front Desk Agent

When a customer messages your business at 9pm and nobody answers, that booking often goes to someone else. This is a small assistant that answers the common questions, offers open time slots, and hands the rest to you.

**Status:** Day 0. Planning is done, code starts next. Nothing here is tested yet.

## The problem, in plain words

Salons, florists, and other service businesses get the same questions all day: *What are your hours? How much is this? Do you have anything Saturday?* The owner is busy with a customer, so messages sit. Some of those customers never come back.

## Why I think it's worth building

One in four Canadian businesses plans to adopt AI within a year, and chatbots are among the top planned uses at 31.8% ([Statistics Canada, Q3 2026, via summary](https://www.bridginglocal.com/post/canadian-business-conditions-q3-2026)). That shows interest, not proof that businesses lose bookings. Proving that is part of this project: it logs every inquiry so the owner can see what was answered and what turned into a booking.

## What the first version does

1. Answers common questions using only the business owner's own information (hours, prices, policies)
2. Offers open booking slots and records the request
3. Passes the customer to the owner when it isn't sure, instead of guessing
4. Keeps a simple log of every conversation

Not in version one: payments, multiple locations, phone calls, an admin panel.

## Success looks like

Run it on one real local business for two weeks. Report how many inquiries it handled, how many became bookings, and what it got wrong.

## Built with

Next.js, Supabase, Vercel, and the Claude API.

See [`docs/PLAN.md`](docs/PLAN.md) for the step-by-step plan.

## Part of

[Ontario SMB Problem Atlas](https://github.com/prajuvin/ontario-smb-problem-atlas), a cited map of what small businesses struggle with.

Built by Praju at YHWH Digital, Toronto. *We refresh businesses. We rise together.*
