import { describe, expect, it } from "vitest";
import { flowDefinitionSchema } from "./flow-types.js";
import {
  FLOW_LIBRARY,
  flowBoasVindasPorOrigem,
  flowLembretesLive,
  flowReativacao,
} from "./library.js";

describe("FLOW_LIBRARY", () => {
  it.each(FLOW_LIBRARY.map((f) => [f.name, f] as const))(
    "flow %s passa no flowDefinitionSchema",
    (_nome, flow) => {
      const resultado = flowDefinitionSchema.safeParse(flow);
      expect(resultado.success).toBe(true);
    },
  );

  it("tem nomes únicos", () => {
    const nomes = FLOW_LIBRARY.map((f) => f.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("todos os flows terminam com um passo end", () => {
    for (const flow of FLOW_LIBRARY) {
      expect(flow.steps.at(-1)).toEqual({ kind: "end" });
    }
  });
});

describe("flowBoasVindasPorOrigem", () => {
  it("gera flow válido com a origem no trigger e na primeira mensagem", () => {
    const flow = flowBoasVindasPorOrigem("Instagram");
    expect(flowDefinitionSchema.safeParse(flow).success).toBe(true);
    expect(flow.trigger).toEqual({ kind: "lead_created", source: "Instagram" });
    expect(flow.steps[0]).toMatchObject({ kind: "send_message" });
    expect(JSON.stringify(flow.steps[0])).toContain("Instagram");
  });
});

describe("flows específicos", () => {
  it("lembretes de live têm 4 envios (D-1, 3h, 15min, ao vivo)", () => {
    const envios = flowLembretesLive.steps.filter((s) => s.kind === "send_message");
    expect(envios).toHaveLength(4);
  });

  it("reativação dispara ao entrar no estágio reativar-depois e espera 30 dias", () => {
    expect(flowReativacao.trigger).toEqual({
      kind: "stage_entered",
      stageKey: "reativar-depois",
    });
    expect(flowReativacao.steps[0]).toEqual({ kind: "wait", minutes: 43200 });
  });
});
