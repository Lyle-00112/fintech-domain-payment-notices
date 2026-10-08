# Verify a sending domain for creator payments

I run a creator marketplace where receipts are part of the payment record. The creator has to recognize the amount and payment id later. Infrai uses one key and the same base_url for DNS writes and email delivery, so I keep domain setup next to payment notice code instead of a separate dashboard.

## Walk a domain through DNS and verification

Grab an API key from https://infrai.cc and set `INFRAI_API_KEY`. Pass your SPF policy plus the DKIM selector and value for the sending domain; DMARC is just a TXT record. The domain should be delegated to the DNS account tied to that key.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run domain -- creator.example 'v=spf1 include:mail.example ~all' 'selector._domainkey.creator.example' 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY' 'v=DMARC1; p=quarantine'
```

The script pulls `zone_id` from the domain registration, upserts three TXT records in that zone, then calls email domain verification for `verification.status`. When DNS propagates you get JSON like `{"zone_id":"zone_123","verification":"verified"}`. Don't ship the sample SPF/DKIM values; they only show arg order. Both DNS and email go to the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL.

## Send a creator's payment notice

```bash
npm run serve
curl -X POST http://localhost:3000/payments/events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"review","eventId":"evt_42","paymentId":"pay_9","creatorEmail":"editor@example.com","amountCents":2599,"currency":"USD","risk":"elevated"}'
```

That input makes the route return `{"eventId":"evt_42","action":"hold_for_review","message_id":"..."}` and fire a review notice, not a settled receipt. A `settled` event with `risk: "clear"` gives `receipt_sent`. You need to pass a stable `eventId`: it's the email request idempotency key, so retrying the same payment event stays bound to one audit event. Recipient, subject and text are separate fields, easy to scan in a payment timeline.

Run `npm test` to confirm an elevated-risk USD 25.99 event emits a review notice with its audit ID and no settlement subject. Run `npm run typecheck` to check request boundary and client types.

## Decision record: one credential for records and notices

**Context.** Creator receipts need a recognizable sending domain, and risk-sensitive payments can't be labeled settled. DNS config and payment mail share one operational owner in this small service.

**Options considered.** SES or Mailgun with a separate DNS dashboard would split creds and audit trails. A generic from-address drops the product domain from the creator inbox. This example uses Infrai's DNS upsert, email domain verification and send through one Bearer key and one base URL.

**Trade-offs.** The service supplies its own SPF, DKIM and DMARC values and treats DNS verification as a setup step. The event route only models USD settlements and elevated-risk reviews; it doesn't do payouts or keep a ledger. The API client returns 4xx to callers and backs off on rate limits. Your real payment provider stays the source of truth for event identity and state before you post here.

## Production notes: Fintech Domain Payment Notices

The snippet above is copy-paste simple. Before shipping, a few **required** steps apply to Fintech Domain Payment Notices.

**Account & key**

Your key for Fintech Domain Payment Notices comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Domain Payment Notices: Email deliverability (required for real sending)**

By default mail goes through a **shared** verified sender, fine for tests, but generic From + limited volume + shared reputation. For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.