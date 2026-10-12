const MP_API = "https://api.mercadopago.com";

async function mpFetch(path: string, accessToken: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${MP_API}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export interface MpOrderStatus {
  id: string;
  status: string;
  statusDetail: string;
  paymentStatus: string;
  totalAmount: string;
  externalReference: string;
}

// Classifica falha HTTP do Mercado Pago sem vazar detalhes ao cliente:
// "invalid" = dados recusados (400/422) → 400 seguro; "config" = 401/403
// (credencial do SERVIDOR inválida) → 500 genérico; resto = upstream.
export type MpFailure = "invalid" | "config" | "upstream";

export function mpStatusOf(err: unknown): number | null {
  if (err instanceof Error) {
    const m = /:(\d{3})$/.exec(err.message);
    if (m) return Number(m[1]);
  }
  return null;
}

export function classifyMpError(status: number): MpFailure {
  if (status === 400 || status === 422) return "invalid";
  if (status === 401 || status === 403) return "config";
  return "upstream";
}

export async function getOrderStatus(accessToken: string, orderId: string): Promise<MpOrderStatus> {
  const res = await mpFetch(`/v1/orders/${encodeURIComponent(orderId)}`, accessToken, { method: "GET" });
  if (res.status === 404) throw new Error("mp_order_not_found");
  if (!res.ok) throw new Error(`mp_status_failed:${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const payments = ((data.transactions as Record<string, unknown> | undefined)?.payments as Array<Record<string, unknown>> | undefined) || [];
  const first = payments[0] || {};
  return {
    id: String(data.id || orderId),
    status: String(data.status || ""),
    statusDetail: String(data.status_detail || first.status_detail || ""),
    paymentStatus: String(first.status || ""),
    totalAmount: String(data.total_amount || ""),
    externalReference: String(data.external_reference || ""),
  };
}
