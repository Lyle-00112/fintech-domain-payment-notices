import { z } from "zod";

export const paymentEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("settled"), eventId: z.string().min(1), paymentId: z.string().min(1), creatorEmail: z.string().email(), amountCents: z.number().int().positive(), currency: z.literal("USD"), risk: z.literal("clear") }),
  z.object({ kind: z.literal("review"), eventId: z.string().min(1), paymentId: z.string().min(1), creatorEmail: z.string().email(), amountCents: z.number().int().positive(), currency: z.literal("USD"), risk: z.literal("elevated") }),
]);

export function notice(event: z.infer<typeof paymentEvent>) {
  const amount = `${event.currency} ${(event.amountCents / 100).toFixed(2)}`;
  if (event.kind === "review") return {
    action: "hold_for_review" as const,
    to: event.creatorEmail,
    subject: `Payment ${event.paymentId} under review`,
    text: `Payment ${event.paymentId} for ${amount} is awaiting review. No payout action is needed. Audit event: ${event.eventId}.`,
  };
  return {
    action: "receipt_sent" as const,
    to: event.creatorEmail,
    subject: `Payment ${event.paymentId} settled`,
    text: `Payment ${event.paymentId} for ${amount} settled. Audit event: ${event.eventId}.`,
  };
}
