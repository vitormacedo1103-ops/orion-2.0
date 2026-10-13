import { createHmac, timingSafeEqual } from "node:crypto";

// Validação e interpretação de webhooks Yampi (docs: /api-reference/webhooks).
// Esquema PRÓPRIO da Yampi — não reutiliza o formato do antigo Mercado Pago:
// header `X-Yampi-Hmac-SHA256` = base64(HMAC-SHA256(corpo_bruto, secret)).

export const YAMPI_SIGNATURE_HEADER = "x-yampi-hmac-sha256";

// Eventos tratados. Demais eventos => 200 ignorado, sem processar.
const HANDLED_EVENTS = new Set(["order.paid", "order.status.updated"]);

export type YampiStatus = "approved" | "pending" | "rejected" | "cancelled" | "refunded" | "unknown";

// Status lido de `resource.status.data.alias` (doc oficial). Desconhecido
// NUNCA aprova (fail closed).
export function mapYampiStatus(alias: unknown): YampiStatus {
  const a = typeof alias === "string" ? alias.toLowerCase() : "";
  if (a === "paid" || a === "approved") return "approved";
  if (a === "waiting_payment" || a === "pending" || a === "authorized") return "pending";
  if (a === "refused" || a === "denied") return "rejected";
  if (a === "cancelled" || a === "canceled") return "cancelled";
  if (a === "refunded" || a === "chargeback") return "refunded";
  return "unknown";
}

export function isHandledEvent(event: unknown): event is string {
  return typeof event === "string" && HANDLED_EVENTS.has(event);
}

export interface YampiParsed {
  event: string;
  resourceId: string;
  statusAlias: unknown;
}

export function parseYampiBody(body: unknown): YampiParsed | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const resource = b.resource as Record<string, unknown> | undefined;
  if (typeof b.event !== "string" || typeof resource !== "object" || resource === null) return null;
  const status = resource.status as Record<string, unknown> | undefined;
  const data = status && typeof status.data === "object" && status.data !== null
    ? (status.data as Record<string, unknown>)
    : undefined;
  return {
    event: b.event,
    resourceId: String((resource as Record<string, unknown>).id ?? ""),
    statusAlias: data ? data.alias : undefined,
  };
}

export function signYampiBody(rawBody: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

export function verifyYampiSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!secret || !signatureHeader || typeof signatureHeader !== "string") return false;
  const expected = signYampiBody(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
