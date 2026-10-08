import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, request } from "./infrai.ts";
import { notice, paymentEvent } from "./payment_notice.ts";

const server = createServer(async (incoming, outgoing) => {
  const reply = (status: number, body: object) => {
    outgoing.writeHead(status, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify(body));
  };
  if (incoming.method !== "POST" || incoming.url !== "/payments/events") {
    reply(404, { error: "Route not found" });
    return;
  }
  try {
    let raw = "";
    for await (const chunk of incoming) {
      raw += chunk;
      if (raw.length > 16_384) { reply(413, { error: "Body too large" }); return; }
    }
    const event = paymentEvent.parse(JSON.parse(raw));
    const message = notice(event);
    const sent = await request<{ message_id: string }>("POST", "/v1/email/send", {
      to: message.to, subject: message.subject, body: message.text,
    }, `payment-notice:${event.eventId}`);
    reply(200, { eventId: event.eventId, action: message.action, message_id: sent.message_id });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) reply(400, { error: "Invalid payment event" });
    else if (error instanceof InfraiError) reply(error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code });
    else reply(502, { error: "Delivery unavailable" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log("Payment event service listening"));
