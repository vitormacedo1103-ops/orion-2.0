import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapMpStatus, PRODUCT, formatAmount } from "../api/_lib/constants.js";
import { createPixOrder } from "../api/_lib/mp.js";

describe("status mapping (fail closed)", () => {
  it("aprova só com acreditação real", () => {
    assert.equal(mapMpStatus("processed", "processed", "accredited"), "approved");
    assert.equal(mapMpStatus("processed", undefined, "accredited"), "approved");
  });
  it("pending nunca é paid", () => {
    assert.equal(mapMpStatus("action_required", undefined, "waiting_transfer"), "pending");
    assert.equal(mapMpStatus(undefined, "in_process", undefined), "pending");
  });
  it("rejeitado/cancelado/estornado mapeados, desconhecido => unknown", () => {
    assert.equal(mapMpStatus(undefined, "rejected", undefined), "rejected");
    assert.equal(mapMpStatus(undefined, "cancelled", undefined), "cancelled");
    assert.equal(mapMpStatus(undefined, "refunded", undefined), "refunded");
    assert.equal(mapMpStatus("weird", "weird", "weird"), "unknown");
    assert.equal(mapMpStatus(undefined, undefined, undefined), "unknown");
  });
});

describe("TESTE 8: preço do frontend é ignorado", () => {
  it("createPixOrder usa sempre R$647,90 do servidor", async () => {
    let captured: Record<string, unknown> = {};
    const origFetch = globalThis.fetch;
    // @ts-expect-error stub de teste
    globalThis.fetch = async (_url: string, init: { body?: string; headers?: Record<string, string> }) => {
      captured = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({ id: "ORD123", status: "action_required", transactions: { payments: [{ qr_code: "PIXCODE" }] } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    };
    try {
      // A função nem aceita preço: a tentativa de injetar price é impossível na assinatura.
      // @ts-expect-error tentativa de injeção
      const order = await createPixOrder({ accessToken: "APP_USR-test", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", email: "a@b.com", externalReference: "x", price: 1 });
      assert.equal(order.orderId, "ORD123");
      assert.equal(captured.total_amount, "647.90");
      const pay = (captured.transactions as { payments: Array<{ amount: string }> }).payments[0];
      assert.equal(pay.amount, "647.90");
      assert.equal(PRODUCT.amountCents, 64790);
      assert.equal(formatAmount(64790), "647.90");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
