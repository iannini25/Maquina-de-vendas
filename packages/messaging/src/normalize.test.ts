import { describe, expect, it } from "vitest";
import { formatPhoneJid, normalizePhone } from "./normalize.js";

describe("normalizePhone", () => {
  it("adiciona 55 a celular com DDD e formatação: (11) 99999-9999", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("5511999999999");
  });

  it("preserva número já em E.164 sem +: 5511999999999", () => {
    expect(normalizePhone("5511999999999")).toBe("5511999999999");
  });

  it("preserva + internacional: +1 555 123 4567", () => {
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
  });

  it("adiciona 55 a fixo de 8 dígitos com DDD: 11 9999-9999", () => {
    expect(normalizePhone("11 9999-9999")).toBe("551199999999");
  });

  it("preserva + em número BR internacional: +55 11 99999-9999", () => {
    expect(normalizePhone("+55 11 99999-9999")).toBe("+5511999999999");
  });

  it("retorna vazio para entrada sem dígitos", () => {
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("formatPhoneJid", () => {
  it("monta o JID do WhatsApp a partir de número formatado", () => {
    expect(formatPhoneJid("(11) 99999-9999")).toBe("5511999999999@s.whatsapp.net");
  });

  it("remove o + de números internacionais", () => {
    expect(formatPhoneJid("+55 11 99999-9999")).toBe("5511999999999@s.whatsapp.net");
  });
});
