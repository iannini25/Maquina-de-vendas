import { describe, expect, it } from "vitest";

import {
  parseMarkdownConfig,
  pilotPlaybookMarkdown,
  validatePersonaMarkdown,
  validatePlaybookMarkdown,
} from "./markdown-config.js";

describe("parseMarkdownConfig", () => {
  it("extrai título e seções com aliases PT-BR", () => {
    const md = `# Meu playbook

## Objetivo
Qualificar rápido.

## Tom e condução
Perguntas curtas.
`;
    const parsed = parseMarkdownConfig(md);
    expect(parsed.title).toBe("Meu playbook");
    expect(parsed.sections["objective"]).toBe("Qualificar rápido.");
    expect(parsed.sections["instructions"]).toBe("Perguntas curtas.");
  });
});

describe("validatePlaybookMarkdown", () => {
  it("o documento-piloto é válido", () => {
    const result = validatePlaybookMarkdown(pilotPlaybookMarkdown("Qualificado"));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.value?.autonomy).toBe("SEMI");
    expect(result.value?.cadence.intervals).toEqual([0, 20, 180, 1440, 4320, 10080]);
    expect(result.value?.allowedActions).toContain("send_text");
  });

  it("acusa seções obrigatórias faltando", () => {
    const result = validatePlaybookMarkdown("# Só título\n");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Objetivo/);
    expect(result.errors.join(" ")).toMatch(/Ações permitidas/);
  });

  it("rejeita ação desconhecida", () => {
    const md = pilotPlaybookMarkdown("X").replace("- send_text", "- lançar_foguete");
    const result = validatePlaybookMarkdown(md);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("lançar_foguete");
  });

  it("rejeita autonomia inválida", () => {
    const md = pilotPlaybookMarkdown("X").replace("Semiauto", "Turbo");
    const result = validatePlaybookMarkdown(md);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Turbo");
  });
});

describe("validatePersonaMarkdown", () => {
  it("valida persona mínima", () => {
    const md = `# Sofia — SDR

## Persona
Sofia, consultora de IA da Liderança IA.

## Tom
Caloroso, direto, sem emojis em excesso.
`;
    const result = validatePersonaMarkdown(md);
    expect(result.ok).toBe(true);
    expect(result.value?.speaksAs).toContain("Sofia");
  });

  it("acusa persona sem tom", () => {
    const result = validatePersonaMarkdown("# X\n\n## Persona\nAlguém.\n");
    expect(result.ok).toBe(false);
  });
});
