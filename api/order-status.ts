import type { Handler } from "./_lib/vercel";
import { envReady, getEnv, mapMpStatus } from "./_lib/constants";
import { clientIp, methodNotAllowed } from "./_lib/http";
import { isOrderId } from "./_lib/validation";
import { rateLimit } from "./_lib/ratelimit";
import { logEvent } from "./_lib/logger";
import { getOrderStatus } from "./_lib/mp";

// GET /api/order-status?id={orderId} — consulta o estado REAL no Mercado Pago.
// Retorna só o status mapeado. Desconhecido => "unknown" (nunca aprova).
const handler: Handler = async (req, res) => {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }
  if (!envReady()) {
    res.status(503).json({ error: "checkout_unavailable" });
    return;
  }
  if (!rateLimit(`status:${clientIp(req)}`, 30, 60_000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const q = req.query.id;
  const id = Array.isArray(q) ? q[0] : q;
  if (!isOrderId(id)) {
    res.status(400).json({ error: "invalid_order_id" });
    return;
  }
  try {
    const mp = await getOrderStatus(getEnv().accessToken, id as string);
    const status = mapMpStatus(mp.status, mp.paymentStatus, mp.statusDetail);
    logEvent("status_checked", { orderId: id, status });
    res.status(200).json({ orderId: mp.id, status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "mp_order_not_found") {
      res.status(404).json({ error: "order_not_found" });
      return;
    }
    logEvent("status_failed", { orderId: id });
    res.status(502).json({ error: "status_unavailable" });
  }
};

export default handler;
