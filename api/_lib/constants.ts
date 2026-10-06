// Constantes do produto — preço SEMPRE definido no servidor.
export const PRODUCT = {
  id: "site-profissional-orionnex",
  name: "Site Profissional Orionnex",
  description: "Criação completa de site profissional personalizado, responsivo e estruturado para sua empresa.",
  amountCents: 64790,
} as const;

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "unknown";

// Mapeia status do Mercado Pago (order + payment) para estados internos.
// Desconhecido NUNCA aprova (fail closed).
export function mapMpStatus(orderStatus?: string, paymentStatus?: string, statusDetail?: string): OrderStatus {
  const o = (orderStatus || "").toLowerCase();
  const p = (paymentStatus || "").toLowerCase();
  const d = (statusDetail || "").toLowerCase();
  if (o === "processed" && (d === "accredited" || p === "processed" || p === "approved")) return "approved";
  if (p === "approved" || p === "accredited") return "approved";
  if (o === "action_required" || p === "pending" || p === "in_process" || d === "waiting_transfer" || d === "pending_waiting_transfer") return "pending";
  if (p === "rejected" || d === "rejected" || o === "rejected") return "rejected";
  if (p === "cancelled" || o === "cancelled" || p === "cancelled_by_user") return "cancelled";
  if (p === "refunded" || p === "charged_back") return "refunded";
  return "unknown";
}

export function getEnv(): { accessToken: string; webhookSecret: string; publicKey: string; siteUrl: string; mpEnv: string } {
  return {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || "",
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || "",
    siteUrl: (process.env.PUBLIC_SITE_URL || "").replace(/\/$/, ""),
    mpEnv: process.env.MP_ENV || "",
  };
}

// Config ausente/inválida => NEGAR (fail closed).
export function envReady(): boolean {
  const e = getEnv();
  return e.accessToken.length > 10 && (e.mpEnv === "test" || e.mpEnv === "production");
}
