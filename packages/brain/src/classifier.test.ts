import { describe, expect, it } from "vitest";

import { buildClassifierPrompt, parseClassifierResponse } from "./classifier.js";

describe("buildClassifierPrompt", () => {
  it("inclui a conversa rotulada e o formato JSON esperado", () => {
    const prompt = buildClassifierPrompt([
      { author: "lead", text: "quanto custa o curso?" },
      { author: "agent", text: "custa R$ 1.997,00" },
      { author: "lead", text: "tá caro demais pra mim" },
    ]);
    expect(prompt).toContain("Lead: quanto custa o curso?");
    expect(prompt).toContain("Vendedor: custa R$ 1.997,00");
    expect(prompt).toContain('"intent"');
    expect(prompt).toContain('"temperature"');
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"objection"');
    expect(prompt).toContain("COLD");
  });
});

describe("parseClassifierResponse", () => {
  it("aceita JSON limpo", () => {
    const result = parseClassifierResponse(
      '{"intent": "comprar", "temperature": "HOT", "score": 85, "objection": "preço"}',
    );
    expect(result).toEqual({ intent: "comprar", temperature: "HOT", score: 85, objection: "preço" });
  });

  it("extrai JSON com lixo em volta (prosa e cerca de código)", () => {
    const result = parseClassifierResponse(
      'Claro! Aqui está a análise:\n```json\n{"intent": "pesquisando", "temperature": "WARM", "score": 55}\n```\nEspero ter ajudado.',
    );
    expect(result).toEqual({ intent: "pesquisando", temperature: "WARM", score: 55 });
  });

  it("tolera score como string numérica", () => {
    const result = parseClassifierResponse(
      '{"intent": "curioso", "temperature": "COLD", "score": "20"}',
    );
    expect(result).toEqual({ intent: "curioso", temperature: "COLD", score: 20 });
  });

  it("normaliza objection null/vazia para ausente", () => {
    const result = parseClassifierResponse(
      '{"intent": "comprar", "temperature": "HOT", "score": 90, "objection": null}',
    );
    expect(result).toEqual({ intent: "comprar", temperature: "HOT", score: 90 });
  });

  it("retorna null para texto sem JSON", () => {
    expect(parseClassifierResponse("não consegui classificar")).toBeNull();
  });

  it("retorna null para JSON malformado", () => {
    expect(parseClassifierResponse('{"intent": "x", temperature: HOT}')).toBeNull();
  });

  it("retorna null para temperatura inválida", () => {
    expect(
      parseClassifierResponse('{"intent": "x", "temperature": "MORNO", "score": 50}'),
    ).toBeNull();
  });

  it("retorna null para score fora do range 0-100", () => {
    expect(
      parseClassifierResponse('{"intent": "x", "temperature": "HOT", "score": 150}'),
    ).toBeNull();
    expect(
      parseClassifierResponse('{"intent": "x", "temperature": "HOT", "score": -5}'),
    ).toBeNull();
  });
});
