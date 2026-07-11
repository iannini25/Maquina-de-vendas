import { describe, expect, it } from "vitest";

import { applyVars, renderEmail, type EmailStructure, type EmailVars } from "./render.js";

const VARS_COMPLETAS: EmailVars = {
  nome: "Bernardo",
  produto: "Mentoria Turbo",
  link_acesso: "https://app.vendaflow.com/acesso?t=abc",
  valor: "R$ 497,00",
  data: "10/07/2026",
};

const OPCOES = { unsubscribeUrl: "https://app.vendaflow.com/unsub?t=xyz" };

describe("applyVars", () => {
  it("substitui todas as variáveis conhecidas", () => {
    const texto = "Oi {nome}, {produto} por {valor} até {data}: {link_acesso}";
    expect(applyVars(texto, VARS_COMPLETAS)).toBe(
      "Oi Bernardo, Mentoria Turbo por R$ 497,00 até 10/07/2026: https://app.vendaflow.com/acesso?t=abc",
    );
  });

  it("mantém variável ausente intacta", () => {
    expect(applyVars("Use o cupom {cupom}, {nome}", VARS_COMPLETAS)).toBe(
      "Use o cupom {cupom}, Bernardo",
    );
  });

  it("substitui múltiplas ocorrências da mesma variável", () => {
    expect(applyVars("{nome} e {nome}", VARS_COMPLETAS)).toBe("Bernardo e Bernardo");
  });
});

describe("renderEmail", () => {
  const estrutura: EmailStructure = {
    headerTitle: "Oi, {nome}",
    buttons: [{ label: "Acessar {produto}", url: "{link_acesso}" }],
    footerText: "Enviado para você por {produto}.",
  };

  it("sempre inclui o link de descadastro", () => {
    const html = renderEmail(estrutura, "Corpo simples.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain(OPCOES.unsubscribeUrl);
    expect(html).toContain("Cancelar inscrição");
  });

  it("renderiza botões com rótulo e URL com variáveis aplicadas", () => {
    const html = renderEmail(estrutura, "Corpo.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain('href="https://app.vendaflow.com/acesso?t=abc"');
    expect(html).toContain("Acessar Mentoria Turbo");
  });

  it("converte **negrito** do markdown leve", () => {
    const html = renderEmail(estrutura, "Isto é **importante**.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain("<strong>importante</strong>");
  });

  it("converte [texto](url) do markdown leve em link", () => {
    const html = renderEmail(
      estrutura,
      "Veja [o guia](https://exemplo.com/guia).",
      VARS_COMPLETAS,
      OPCOES,
    );
    expect(html).toContain('<a href="https://exemplo.com/guia"');
    expect(html).toContain(">o guia</a>");
  });

  it("separa parágrafos por linha em branco", () => {
    const html = renderEmail(estrutura, "Primeiro.\n\nSegundo.", VARS_COMPLETAS, OPCOES);
    const paragrafos = html.match(/<p /g) ?? [];
    // 2 parágrafos do corpo + 1 do footerText + 1 do descadastro.
    expect(paragrafos.length).toBe(4);
    expect(html).toContain("Primeiro.");
    expect(html).toContain("Segundo.");
  });

  it("escapa HTML injetado no corpo e no título", () => {
    const maliciosa: EmailStructure = { headerTitle: "<script>alert(1)</script>" };
    const html = renderEmail(maliciosa, "Corpo com <b>tag</b>.", VARS_COMPLETAS, OPCOES);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;tag&lt;/b&gt;");
  });

  it("usa fundo e acento padrão dark", () => {
    const html = renderEmail(estrutura, "Corpo.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain("#08080B");
    expect(html).toContain("#8B5CF6");
    expect(html).toContain("#F4F4F7");
  });

  it("aceita override de acento e fundo via style", () => {
    const customizada: EmailStructure = {
      ...estrutura,
      style: { accentColor: "#22C55E", backgroundColor: "#000000" },
    };
    const html = renderEmail(customizada, "Corpo.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain("#22C55E");
    expect(html).toContain("background-color: #000000");
    expect(html).not.toContain("#8B5CF6");
  });

  it("aplica variáveis no título do header", () => {
    const html = renderEmail(estrutura, "Corpo.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain("Oi, Bernardo");
  });

  it("limita o container a 600px", () => {
    const html = renderEmail(estrutura, "Corpo.", VARS_COMPLETAS, OPCOES);
    expect(html).toContain('width="600"');
    expect(html).toContain("max-width: 600px");
  });
});
