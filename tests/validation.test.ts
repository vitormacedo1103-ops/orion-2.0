import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCpf, isEmail, isPhoneBr, isName, isUuidV4, isOrderId, isPaymentMethod, maskCpf } from "../api/_lib/validation.js";

describe("validation", () => {
  it("aceita CPF válido e rejeita inválidos", () => {
    assert.equal(isCpf("123.456.789-09"), true);
    assert.equal(isCpf("111.111.111-11"), false);
    assert.equal(isCpf("123"), false);
    assert.equal(isCpf(123), false);
  });
  it("valida email com limites", () => {
    assert.equal(isEmail("cliente@empresa.com"), true);
    assert.equal(isEmail("sem-arroba"), false);
    assert.equal(isEmail("a@b"), false);
  });
  it("valida telefone BR 10/11 dígitos", () => {
    assert.equal(isPhoneBr("(81) 99999-9999"), true);
    assert.equal(isPhoneBr("8133334444"), true);
    assert.equal(isPhoneBr("123"), false);
  });
  it("valida nome, uuid v4, order id e método", () => {
    assert.equal(isName("Maria Silva"), true);
    assert.equal(isName("AB"), false);
    assert.equal(isUuidV4("123e4567-e89b-42d3-a456-426614174000"), true);
    assert.equal(isUuidV4("mesma-chave"), false);
    assert.equal(isOrderId("ORD01M28P44G5FG8RJPM579EH56FV"), true);
    assert.equal(isOrderId("../../etc"), false);
    assert.equal(isPaymentMethod("pix"), true);
    assert.equal(isPaymentMethod("boleto"), false);
  });
  it("mascara CPF no log", () => {
    assert.equal(maskCpf("123.456.789-09"), "123.456.***-**");
  });
});
