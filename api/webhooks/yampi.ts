import type { Handler } from "../_lib/vercel.js";
import { clientIp, header, methodNotAllowed } from "../_lib/http.js";
import { rateLimit } from "../_lib/ratelimit.js";
import { logEvent } from "../_lib/logger.js";
import { getStore } from "../_lib/store.js";
import { isHandledEvent, mapYampiStatus, parseYampiBody, verifyYampiSignature } from "../_lib/yampi.js";

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 64 * 1024;

// POST /api/webhooks/yampi — notificações da Yampi (order.paid, order.status.updated).
// 1. corpo bruto (para o HMAC) 2. valida assinatura 3. filtra eventos
// 4. idempotência por (evento, pedido, status) 5. responde 2XX rápido.
const handler: Handler = async (req, res) => {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  const secret = process.env.YAMPI_WEBHOOK_SECRET || "";
  if (!secret) {
    logEvent("yampi_no_config");
    res.status(503).json({ error: "webhook_unavailable" });
    return;
  }
  if (!rateLimit(`yampi:${clientIp(req)}`, 60, 60_000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        res.status(413).json({ error: "body_too_large" });
        return;
      }
      chunks.push(buf);
    }
  } catch {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const raw = Buffer.concat(chunks);

  if (!verifyYampiSignature(raw, header(req, "x-yampi-hmac-sha256"), secret)) {
    logEvent("yampi_bad_signature");
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  const parsed = parseYampiBody(body);
  if (!parsed || !parsed.resourceId) {
    res.status(400).json({ error: "invalid_event" });
    return;
  }
  if (!isHandledEvent(parsed.event)) {
    logEvent("yampi_event_ignored", { event: parsed.event });
    res.status(200).json({ received: true, processed: false });
    return;
  }

  const status = mapYampiStatus(parsed.statusAlias);
  const store = getStore();
  const eventKey = `yampi:${parsed.resourceId}:${parsed.event}:${status}`;
  if (await store.has(eventKey)) {
    logEvent("yampi_duplicate", { orderId: parsed.resourceId });
    res.status(200).json({ received: true, processed: false });
    return;
  }

  if (status === "unknown") {
    logEvent("yampi_unknown_status", { orderId: parsed.resourceId, event: parsed.event });
    res.status(200).json({ received: true, processed: false });
    return;
  }

  await store.add(eventKey, 30 * 24 * 3600);
  logEvent("yampi_processed", { orderId: parsed.resourceId, event: parsed.event, status });
  res.status(200).json({ received: true, processed: true, status });
};

export default handler;
