import { formatAmount, PRODUCT } from "./constants";

const MP_API = "https://api.mercadopago.com";

interface MpCallOpts {
  accessToken: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

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

export interface PixOrderResult {
  orderId: string;
  status: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
}

export async function createPixOrder(opts: MpCallOpts & { email: string; externalReference: string }): Promise<PixOrderResult> {
  const amount = formatAmount(PRODUCT.amountCents); // preço SEMPRE do servidor
  const res = await mpFetch(
    "/v1/orders",
    opts.accessToken,
    {
      method: "POST",
      headers: { "X-Idempotency-Key": opts.idempotencyKey || "" },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        total_amount: amount,
        external_reference: opts.externalReference,
        payer: { email: opts.email },
        transactions: {
          payments: [
            {
              amount,
              payment_method: { id: "pix", type: "bank_transfer" },
            },
          ],
        },
      }),
    },
    opts.timeoutMs
  );
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`mp_create_pix_failed:${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const payments = ((data.transactions as Record<string, unknown> | undefined)?.payments as Array<Record<string, unknown>> | undefined) || [];
  const first = payments[0] || {};
  return {
    orderId: String(data.id || ""),
    status: String(data.status || ""),
    qrCode: typeof first.qr_code === "string" ? first.qr_code : undefined,
    qrCodeBase64: typeof first.qr_code_base64 === "string" ? first.qr_code_base64 : undefined,
    ticketUrl: typeof first.ticket_url === "string" ? first.ticket_url : undefined,
  };
}

export interface CardOrderResult {
  orderId: string;
  status: string;
  statusDetail?: string;
}

export async function createCardOrder(
  opts: MpCallOpts & {
    email: string;
    externalReference: string;
    cardToken: string;
    paymentMethodId: string;
    installments: number;
    identification?: { type: string; number: string };
  }
): Promise<CardOrderResult> {
  const amount = formatAmount(PRODUCT.amountCents); // preço SEMPRE do servidor
  const res = await mpFetch(
    "/v1/orders",
    opts.accessToken,
    {
      method: "POST",
      headers: { "X-Idempotency-Key": opts.idempotencyKey || "" },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        total_amount: amount,
        external_reference: opts.externalReference,
        payer: {
          email: opts.email,
          ...(opts.identification ? { identification: opts.identification } : {}),
        },
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: opts.paymentMethodId,
                type: "credit_card",
                token: opts.cardToken,
                installments: opts.installments,
              },
            },
          ],
        },
      }),
    },
    opts.timeoutMs
  );
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`mp_create_card_failed:${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const payments = ((data.transactions as Record<string, unknown> | undefined)?.payments as Array<Record<string, unknown>> | undefined) || [];
  const first = payments[0] || {};
  return {
    orderId: String(data.id || ""),
    status: String(data.status || ""),
    statusDetail: typeof first.status_detail === "string" ? first.status_detail : undefined,
  };
}

export interface MpOrderStatus {
  id: string;
  status: string;
  statusDetail: string;
  paymentStatus: string;
  totalAmount: string;
  externalReference: string;
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
