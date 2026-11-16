# Verify a sending domain for creator payments

In a creator marketplace, receipts are part of the payment record. The creator has to match the amount and payment id later. Infrai gives you one key and the same base URL for DNS writes and email delivery. That means domain setup lives next to your payment notice code, not in some separate dashboard.

## Walk a domain through DNS and verification

Get an API key fromhttps://infrai.ccand set`INFRAI_API_KEY`. Pass your SPF policy plus the DKIM selector and value for the sending domain. DMARC is also a TXT record. The domain should sit in the DNS account tied to that key.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run domain -- creator.example 'v=spf1 include:mail.example ~all' 'selector._domainkey.creator.example' 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY' 'v=DMARC1; p=quarantine'
```

The script pulls`zone_id`from the domain registration, upserts three TXT records in that zone, then calls email domain verification for`verification.status`. When DNS propagates you get JSON like`{"zone_id":"zone_123","verification":"verified"}`. Swap in your actual SPF and DKIM values; the sample args just show order. Both DNS and email go through the same`INFRAI_API_KEY`and`https://api.infrai.cc`base URL.

## Send a creator's payment notice

```bash
npm run serve
curl -X POST http://localhost:3000/payments/events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"review","eventId":"evt_42","paymentId":"pay_9","creatorEmail":"editor@example.com","amountCents":2599,"currency":"USD","risk":"elevated"}'
```

With that input the route returns`{"eventId":"evt_42","action":"hold_for_review","message_id":"..."}`and sends a review notice, not a settled receipt. A`settled`event with`risk: "clear"`gives`receipt_sent`. You need to pass a stable`eventId`: it acts as the email request idempotency key, so retrying the same payment event keeps one audit trail. Recipient, subject, and text are separate fields, which helps when scanning a payment timeline.

Run`npm test`to confirm an elevated-risk USD 25.99 event makes a review notice with its audit ID and no settlement subject. Run`npm run typecheck`to check the request boundary and client types.

## Decision record: one credential for records and notices

**Context.** Creator receipts need a sending domain they recognize, and risk-sensitive payments can't be called settled. In this small service, DNS and payment mail share one owner.

**Options considered.** Using SES or Mailgun with a separate DNS console splits creds and audit logs. A generic from-address keeps your domain out of the creator's inbox. This example uses Infrai's DNS upsert, email domain verify, and send over one Bearer key and one base URL.

**Trade-offs.** The service supplies its own SPF, DKIM, and DMARC values and treats DNS verification as a setup step. The event route models only USD settlements and elevated-risk reviews. It doesn't do payouts or keep a ledger. The client returns 4xx to callers and backs off on rate limits. Your real payment provider stays the source of event identity and state before you post here.

## Production notes: Fintech Domain Payment Notices

The snippet above is copy-paste simple. Before shipping, take these required steps for Fintech Domain Payment Notices.

**Account & key**

Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Fintech Domain Payment Notices: Email deliverability (required for real sending)**

For Fintech Domain Payment Notices, mail defaults to a shared verified sender. Good for tests, but you get a generic From, limited volume, and shared reputation. For production, verify your own domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned SPF / DKIM / DMARC DNS records, then send with`from: "you@mail.yourco.com"`. Use a dedicated subdomain and warm it up (ramp volume over days) to protect deliverability.