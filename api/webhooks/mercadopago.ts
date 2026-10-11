import type { Handler } from "../_lib/vercel.js";
import { envReady, getEnv, mapMpStatus } from "../_lib/constants.js";
import { badRequest, clientIp, header, methodNotAllowed } from "../_lib/http.js";
import { verifySignature } from "../_lib/signature.js";
import { rateLimit } from "../_lib/ratelimit.js";
import { logEvent } from "../_lib/logger.js";
import { cacheStatus, getStore } from "../_lib/store.js";
import { getOrderStatus, mpStatusOf } from "../_lib/mp.js";

// POST /api/webhooks/mercadopago?type=...&data.id=...
// 1. valida assinatura (fail closed) 2. confirma estado real na Order
// 3. processa uma única vez (idempotência) 4. responde ao Mercado Pago.
const handler: Handler = async (req, res) => {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  const env = getEnv();
  if (!envReady() || !env.webhookSecret) {
    logEvent("webhook_no_config");
    res.status(503).json({ error: "webhook_unavailable" });
    return;
  }
  if (!rateLimit(`webhook:${clientIp(req)}`, 60, 60_000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }

  const q = req.query;
  const rawId = Array.isArray(q["data.id"]) ? q["data.id"][0] : q["data.id"];
  const dataId = typeof rawId === "string" ? rawId : undefined;
  const valid = verifySignature({
    xSignature: header(req, "x-signature"),
    xRequestId: header(req, "x-request-id"),
    dataId,
    secret: env.webhookSecret,
  });
  if (!valid) {
    logEvent("webhook_bad_signature", { dataId });
    res.status(401).json({ error: "invalid_signature" });
    return;
  }
  if (!dataId || !/^[A-Za-z0-9-]{4,64}$/.test(dataId)) {
    badRequest(res, "invalid_data_id");
    return;
  }

  // Idempotência: evento já processado => 200 sem repetir.
  const store = getStore();
  const eventKey = `webhook:${dataId}`;
  if (await store.has(eventKey)) {
    logEvent("webhook_duplicate", { dataId });
    res.status(200).json({ received: true });
    return;
  }

  try {
    const mp = await getOrderStatus(env.accessToken, dataId);
    const status = mapMpStatus(mp.status, mp.paymentStatus, mp.statusDetail);
    if (status === "unknown") {
      logEvent("webhook_unknown_status", { dataId });
      res.status(200).json({ received: true }); // não reprocessa às cegas
      return;
    }
    cacheStatus(mp.id, status);
    await store.add(eventKey, 7 * 24 * 3600);
    logEvent("webhook_processed", { dataId, status });
    res.status(200).json({ received: true });
  } catch (err) {
    // Order inexistente (ex: ID fictício "123456" da simulação): não há nada
    // para confirmar — ack 200 para encerrar retries, sem aprovar nada.
    // Qualquer outro erro: 502 para o MP tentar de novo, com etapa e status
    // do provedor no log (sem segredos) para distinguir auth/rede/config.
    if (err instanceof Error && err.message === "mp_order_not_found") {
      logEvent("webhook_unknown_order", { dataId });
      res.status(200).json({ received: true, processed: false });
      return;
    }
    const providerStatus = mpStatusOf(err);
    if (providerStatus === 401 || providerStatus === 403) {
      logEvent("webhook_auth_error", { dataId, stage: "confirm_order", providerStatus });
    } else {
      logEvent("webhook_failed", { dataId, stage: "confirm_order", providerStatus });
    }
    res.status(502).json({ error: "verification_failed" });
  }
};

export default handler;
