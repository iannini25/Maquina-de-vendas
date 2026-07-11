import { describe, expect, it } from "vitest";

import { computeFinanceKpis, computeForecast, formatBRL } from "./roi.js";

describe("computeFinanceKpis", () => {
  it("calcula KPIs com números redondos", () => {
    const kpis = computeFinanceKpis({
      totalExpensesCents: 100_000, // R$ 1.000
      totalRevenueCents: 400_000, // R$ 4.000
      paidTrafficCents: 80_000, // R$ 800
      ordersCount: 2,
      newLeadsCount: 40,
      wonLeadsCount: 2,
    });
    expect(kpis.profitCents).toBe(300_000);
    expect(kpis.roi).toBe(3);
    expect(kpis.roas).toBe(5);
    expect(kpis.cacCents).toBe(50_000);
    expect(kpis.avgTicketCents).toBe(200_000);
    expect(kpis.margin).toBe(0.75);
    expect(kpis.cplCents).toBe(2_000);
  });

  it("retorna null nos KPIs sem denominador (não divide por zero)", () => {
    const kpis = computeFinanceKpis({
      totalExpensesCents: 0,
      totalRevenueCents: 0,
      paidTrafficCents: 0,
      ordersCount: 0,
      newLeadsCount: 0,
      wonLeadsCount: 0,
    });
    expect(kpis.roi).toBeNull();
    expect(kpis.roas).toBeNull();
    expect(kpis.cacCents).toBeNull();
    expect(kpis.avgTicketCents).toBeNull();
    expect(kpis.margin).toBeNull();
    expect(kpis.cplCents).toBeNull();
  });
});

describe("computeForecast", () => {
  it("combina tendência 30d com pipeline ponderado", () => {
    const forecast = computeForecast({
      revenueLast30dCents: 1_000_000,
      revenuePrev30dCents: 800_000,
      pipeline: [
        { stageId: "a", totalValueCents: 500_000, historicalWinRate: 0.2 },
        { stageId: "b", totalValueCents: 200_000, historicalWinRate: 0.5 },
      ],
    });
    expect(forecast.trendNext30dCents).toBe(1_250_000);
    expect(forecast.weightedPipelineCents).toBe(200_000);
    expect(forecast.estimateCents).toBe(1_450_000);
    expect(forecast.isEstimate).toBe(true);
  });

  it("trava o fator de crescimento em [0.5, 2]", () => {
    const explosive = computeForecast({
      revenueLast30dCents: 1_000_000,
      revenuePrev30dCents: 100_000,
      pipeline: [],
    });
    expect(explosive.trendNext30dCents).toBe(2_000_000);

    const collapsing = computeForecast({
      revenueLast30dCents: 100_000,
      revenuePrev30dCents: 1_000_000,
      pipeline: [],
    });
    expect(collapsing.trendNext30dCents).toBe(50_000);
  });

  it("sem histórico anterior assume fator 1", () => {
    const forecast = computeForecast({
      revenueLast30dCents: 500_000,
      revenuePrev30dCents: 0,
      pipeline: [],
    });
    expect(forecast.trendNext30dCents).toBe(500_000);
  });
});

describe("formatBRL", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(199_700).replace(/ /g, " ")).toBe("R$ 1.997,00");
  });
});
