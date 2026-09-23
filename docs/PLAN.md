# Build plan

One step at a time. Each step ends with something you can see working.

| Step | What gets built | You can see it when |
| --- | --- | --- |
| 1 | Project setup, database, sign-in for the owner | The owner can log in and see an empty dashboard |
| 2 | Business info form: hours, services, prices, policies | Saved info shows on screen |
| 3 | Chat that answers only from that info | Ask a question, get a correct answer, ask something unknown, get a hand-off |
| 4 | Booking request capture | A request appears in the owner's list |
| 5 | Conversation log and simple counts | Dashboard shows inquiries and requests |
| 6 | Deploy and test on one real business | Two weeks of real results |

## Data tables

- `businesses`: name, hours, contact
- `services`: business, name, price, notes
- `conversations`: business, started at, outcome
- `messages`: conversation, sender, text
- `booking_requests`: conversation, requested time, status

## Rules the assistant follows

- Answer only from the owner's saved information
- Never invent a price, time, or policy
- When unsure, say so and pass it to the owner
- Say clearly that it is an automated assistant

## Open questions

- Which channel first: website chat, text messages, or Instagram messages?
- Which live client will test it, and do they agree to it?
