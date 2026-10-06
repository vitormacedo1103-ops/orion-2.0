import { randomUUID } from "node:crypto";
import type { Handler } from "./_lib/vercel";
import { PRODUCT, envReady, getEnv } from "./_lib/constants";
import { badRequest, clientIp, header, methodNotAllowed, readJsonBody, sameOrigin, serverError } from "./_lib/http";
import { isCpf, isEmail, isName, isPaymentMethod, isPhoneBr, isUuidV4 } from "./_lib/validation";
import { rateLimit } from "./_lib/ratelimit";
import { logEvent } from "./_lib/logger";
import { cacheStatus, getStore } from "./_lib/store";
import { createCardOrder, createPixOrder } from "./_lib/mp";
import { mapMpStatus } from "./_lib/constants";

interface CreateOrderBody {
  name?: unknown;
  email?: unknown;
  cpf?: unknown;
  whatsapp?: unknown;
  method?: unknown;
  cardToken?: unknown;
  paymentMethodId?: unknown;
  installments?: unknown;
  identificationType?: unknown;
  identificationNumber?: unknown;
}

// POST /api/create-order — cria Order no Mercado Pago (preço fixo do servidor).
const handler: Handler = async (req, res) => {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  if (!envReady()) {
    logEvent("create_order_no_config");
    res.status(503).json({ error: "checkout_unavailable" });
    return;
  }
  const env = getEnv();
  if (!sameOrigin(req, env.siteUrl)) {
    logEvent("create_order_bad_origin");
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (!rateLimit(`create:${clientIp(req)}`, 10, 60_000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const idempotencyKey = header(req, "x-idempotency-key");
  if (!isUuidV4(idempotencyKey)) {
    badRequest(res, "invalid_idempotency_key");
    return;
  }
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    badRequest(res, parsed.error);
    return;
  }
  const b = (parsed.data || {}) as CreateOrderBody;
  if (!isName(b.name) || !isEmail(b.email) || !isCpf(b.cpf) || !isPhoneBr(b.whatsapp) || !isPaymentMethod(b.method)) {
    badRequest(res, "invalid_customer_data");
    return;
  }

  // Idempotência local: mesma chave => mesma resposta, sem recriar no MP.
  const store = getStore();
  const seenKey = `idem:${idempotencyKey}`;
  if (await store.has(seenKey)) {
    res.status(409).json({ error: "duplicate_request" });
    return;
  }

  const email = (b.email as string).trim().toLowerCase();
  const externalReference = `orionnex-${randomUUID()}`;

  try {
    if (b.method === "pix") {
      const order = await createPixOrder({
        accessToken: env.accessToken,
        idempotencyKey: idempotencyKey as string,
        email,
        externalReference,
      });
      if (!order.orderId) throw new Error("mp_empty_order");
      await store.add(seenKey, 24 * 3600);
      cacheStatus(order.orderId, "pending");
      logEvent("order_created", { method: "pix", orderId: order.orderId, email, cpf: b.cpf });
      res.status(201).json({
        orderId: order.orderId,
        status: "pending",
        pix: { qrCode: order.qrCode, qrCodeBase64: order.qrCodeBase64, ticketUrl: order.ticketUrl },
      });
      return;
    }

    // Cartão: token gerado pelo Card Payment Brick (nunca dados brutos).
    if (typeof b.cardToken !== "string" || b.cardToken.length < 10 || b.cardToken.length > 100) {
      badRequest(res, "invalid_card_token");
      return;
    }
    if (typeof b.paymentMethodId !== "string" || !/^[a-z_]{2,30}$/.test(b.paymentMethodId)) {
      badRequest(res, "invalid_payment_method");
      return;
    }
    const installments = Number(b.installments);
    if (!Number.isInteger(installments) || installments < 1 || installments > 21) {
      badRequest(res, "invalid_installments");
      return;
    }
    let identification: { type: string; number: string } | undefined;
    if (b.identificationType !== undefined || b.identificationNumber !== undefined) {
      if (typeof b.identificationType !== "string" || !/^[A-Z]{2,10}$/.test(b.identificationType)) {
        badRequest(res, "invalid_identification");
        return;
      }
      if (typeof b.identificationNumber !== "string" || b.identificationNumber.length < 3 || b.identificationNumber.length > 20) {
        badRequest(res, "invalid_identification");
        return;
      }
      identification = { type: b.identificationType, number: b.identificationNumber };
    }

    const order = await createCardOrder({
      accessToken: env.accessToken,
      idempotencyKey: idempotencyKey as string,
      email,
      externalReference,
      cardToken: b.cardToken,
      paymentMethodId: b.paymentMethodId,
      installments,
      identification,
    });
    if (!order.orderId) throw new Error("mp_empty_order");
    await store.add(seenKey, 24 * 3600);
    const status = mapMpStatus(order.status, undefined, order.statusDetail);
    cacheStatus(order.orderId, status);
    logEvent("order_created", { method: "card", orderId: order.orderId, email, cpf: b.cpf, status });
    res.status(201).json({ orderId: order.orderId, status });
  } catch (err) {
    logEvent("order_failed", { method: b.method, email });
    serverError(res);
  }
};

export default handler;
export { PRODUCT };
