import { describe, expect, it } from "vitest";

import { renderEmail, type EmailVars } from "./render.js";
import { SEED_EMAIL_PURPOSES, SEED_EMAIL_TEMPLATES } from "./templates.js";

const VARS: EmailVars = {
  nome: "Ana",
  produto: "Curso Alfa",
  link_acesso: "https://app.vendaflow.com/acesso",
  valor: "R$ 197,00",
  data: "hoje às 20h",
};

describe("SEED_EMAIL_TEMPLATES", () => {
  it("tem 8 templates, um por propósito seed", () => {
    expect(SEED_EMAIL_TEMPLATES).toHaveLength(8);
    const propositos = SEED_EMAIL_TEMPLATES.map((t) => t.purpose);
    expect(new Set(propositos).size).toBe(8);
    expect([...propositos].sort()).toEqual([...SEED_EMAIL_PURPOSES].sort());
  });

  it("todo template tem name, corpo e pelo menos um botão", () => {
    for (const template of SEED_EMAIL_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.bodyText.length).toBeGreaterThan(0);
      expect(template.structure.buttons?.length ?? 0).toBeGreaterThan(0);
      expect(template.structure.footerText?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("renderiza sem deixar placeholders quando todas as variáveis são passadas", () => {
    for (const template of SEED_EMAIL_TEMPLATES) {
      const html = renderEmail(template.structure, template.bodyText, VARS, {
        unsubscribeUrl: "https://app.vendaflow.com/unsub",
      });
      expect(html).not.toMatch(/\{[a-z_]+\}/i);
      expect(html).toContain("https://app.vendaflow.com/unsub");
    }
  });

  it("usa {link_acesso} como destino dos botões", () => {
    for (const template of SEED_EMAIL_TEMPLATES) {
      const urls = (template.structure.buttons ?? []).map((b) => b.url);
      expect(urls).toContain("{link_acesso}");
    }
  });
});
