import assert from "node:assert/strict";
import test from "node:test";
import { notice, paymentEvent } from "./payment_notice.ts";

test("elevated-risk creator payment gets a review notice, never a settlement receipt", () => {
  const event = paymentEvent.parse({ kind: "review", eventId: "evt_42", paymentId: "pay_9", creatorEmail: "editor@example.com", amountCents: 2599, currency: "USD", risk: "elevated" });
  const result = notice(event);
  assert.equal(result.action, "hold_for_review");
  assert.match(result.text, /USD 25\.99 is awaiting review/);
  assert.match(result.text, /evt_42/);
  assert.doesNotMatch(result.subject, /settled/);
});
