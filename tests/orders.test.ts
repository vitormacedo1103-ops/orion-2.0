import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapMpStatus, PRODUCT } from "../api/_lib/constants.js";

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

describe("preço de produção", () => {
  it("PRODUCT mantém R$647,90 como referência do backend legado", () => {
    assert.equal(PRODUCT.amountCents, 64790);
  });
});
