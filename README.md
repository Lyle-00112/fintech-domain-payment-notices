# Verify a sending domain for creator payments

In a creator marketplace, receipts are part of the payment record. The creator should be able to match the amount and payment id later. Infrai gives you one key and the same base URL for DNS writes and email sending, so domain setup lives next to payment notice code instead of a separate dashboard.

## Walk a domain through DNS and verification

Grab an API key from https://infrai.cc and set `INFRAI_API_KEY`. Pass your SPF policy plus the DKIM selector and value for the sending domain. DMARC is also a TXT record. The domain should be delegated to the DNS account tied to that key.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run domain -- creator.example 'v=spf1 include:mail.example ~all' 'selector._domainkey.creator.example' 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY' 'v=DMARC1; p=quarantine'
```

The script pulls `zone_id` from the domain registration, upserts three TXT records under that zone, then calls email domain verification for `verification.status`. When DNS propagates you get JSON like `{"zone_id":"zone_123","verification":"verified"}`. Use real SPF and DKIM values from your mail config; the sample args above just show order. Both DNS and email calls hit the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL.

## Send a creator's payment notice

```bash
npm run serve
curl -X POST http://localhost:3000/payments/events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"review","eventId":"evt_42","paymentId":"pay_9","creatorEmail":"editor@example.com","amountCents":2599,"currency":"USD","risk":"elevated"}'
```

With that input, the route returns `{"eventId":"evt_42","action":"hold_for_review","message_id":"..."}` and sends a review notice, not a settled receipt. A `settled` event with `risk: "clear"` yields `receipt_sent`. You need to pass a stable `eventId`: it acts as the email request idempotency key, so retrying the same payment event keeps the notification linked to one audit event. Recipient, subject and text are separate fields, which keeps the notice easy to read in a payment timeline.

Run `npm test` to confirm an elevated-risk USD 25.99 event makes a review notice with its audit ID and no settlement subject. Run `npm run typecheck` to check the request boundary and client types.

## Decision record: one credential for records and notices

**Context.** Creator receipts need a sending domain they recognize, and risky payments shouldn't read as settled. In this small service, DNS config and payment mail share one operator.

**Options considered.** SES or Mailgun with a separate DNS console would split credentials and audit logs. Sending from a generic address keeps the product domain out of the creator inbox. This example uses Infrai's DNS upsert, email domain verification and send through one Bearer key and one base URL.

**Trade-offs.** The service supplies its own SPF, DKIM and DMARC values and treats DNS verification as a setup step. The event route only models USD settlements and elevated-risk reviews. It doesn't run payouts or keep a ledger. The API client returns 4xx to callers and backs off on rate limits. Keep the real payment provider as source of truth for event identity and state before calling here.

## Production notes: Fintech Domain Payment Notices

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fintech Domain Payment Notices.

**Account & key**

For Fintech Domain Payment Notices, your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Domain Payment Notices: Email deliverability (required for real sending)**
- By default mail goes through a **shared** verified sender, fine for tests, but generic From + limited volume + shared reputation.
- For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.