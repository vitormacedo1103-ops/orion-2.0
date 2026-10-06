import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildManifest, parseSignature, signManifest, verifySignature } from "../api/_lib/signature.js";

const SECRET = "test-webhook-secret-123";

describe("webhook signature (fórmula oficial MP)", () => {
  it("monta o manifest no formato id;request-id;ts;", () => {
    assert.equal(
      buildManifest("ORD01M28P44G5FG8RJPM579EH56FV", "2066ca19-c6f1-498a-be75-1923005edd06", "1742505638683"),
      "id:ord01m28p44g5fg8rjpm579eh56fv;request-id:2066ca19-c6f1-498a-be75-1923005edd06;ts:1742505638683;"
    );
  });
  it("roundtrip: assina e valida", () => {
    const manifest = buildManifest("ord123", "req-1", "1704908010");
    const v1 = signManifest(manifest, SECRET);
    assert.equal(verifySignature({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: "req-1", dataId: "ORD123", secret: SECRET }), true);
  });
  it("TESTE 7: rejeita assinatura inválida/ausente (fail closed)", () => {
    assert.equal(verifySignature({ xSignature: "ts=1,v1=deadbeef", xRequestId: "req-1", dataId: "ord1", secret: SECRET }), false);
    assert.equal(verifySignature({ xSignature: undefined, xRequestId: "req-1", dataId: "ord1", secret: SECRET }), false);
    assert.equal(verifySignature({ xSignature: "lixo", xRequestId: "req-1", dataId: "ord1", secret: SECRET }), false);
  });
  it("rejeita sem secret configurado", () => {
    assert.equal(verifySignature({ xSignature: "ts=1,v1=aa", xRequestId: "r", dataId: "o", secret: "" }), false);
  });
  it("parseSignature rejeita formato errado", () => {
    assert.equal(parseSignature("sem-igual"), null);
    assert.equal(parseSignature("ts=1"), null);
  });
});
