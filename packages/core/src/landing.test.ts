import { describe, expect, it } from "vitest";

import { detectDevice, pickVariant, pickWinner, type VariantRef } from "./landing.js";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const IPAD_UA = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_TABLET_UA = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0";

describe("detectDevice", () => {
  it("classifica user agents", () => {
    expect(detectDevice(IPHONE_UA)).toBe("MOBILE");
    expect(detectDevice(IPAD_UA)).toBe("TABLET");
    expect(detectDevice(ANDROID_TABLET_UA)).toBe("TABLET");
    expect(detectDevice(DESKTOP_UA)).toBe("DESKTOP");
  });
});

describe("pickVariant", () => {
  const variants: VariantRef[] = [
    { id: "mobile-a", deviceTarget: "MOBILE", weight: 50 },
    { id: "any-a", deviceTarget: "ANY", weight: 50 },
    { id: "any-b", deviceTarget: "ANY", weight: 50 },
  ];

  it("variante específica do device tem prioridade", () => {
    const chosen = pickVariant(variants, "MOBILE", "visitor-1");
    expect(chosen?.id).toBe("mobile-a");
  });

  it("sem específica, sorteia entre ANY por peso", () => {
    const chosen = pickVariant(variants, "DESKTOP", "visitor-1");
    expect(["any-a", "any-b"]).toContain(chosen?.id);
  });

  it("mesmo visitante sempre cai no mesmo bucket (sticky)", () => {
    const first = pickVariant(variants, "DESKTOP", "visitor-42");
    for (let i = 0; i < 10; i++) {
      expect(pickVariant(variants, "DESKTOP", "visitor-42")?.id).toBe(first?.id);
    }
  });

  it("distribui aproximadamente pelo peso", () => {
    const weighted: VariantRef[] = [
      { id: "heavy", deviceTarget: "ANY", weight: 90 },
      { id: "light", deviceTarget: "ANY", weight: 10 },
    ];
    let heavy = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickVariant(weighted, "DESKTOP", `v${i}`)?.id === "heavy") heavy++;
    }
    expect(heavy).toBeGreaterThan(800);
    expect(heavy).toBeLessThan(980);
  });

  it("lista vazia retorna null", () => {
    expect(pickVariant([], "DESKTOP", "v")).toBeNull();
  });
});

describe("pickWinner", () => {
  it("exige amostra mínima", () => {
    expect(
      pickWinner([
        { id: "a", views: 50, conversions: 10 },
        { id: "b", views: 50, conversions: 1 },
      ]),
    ).toBeNull();
  });

  it("declara vencedora com vantagem relativa >= 10%", () => {
    expect(
      pickWinner([
        { id: "a", views: 500, conversions: 50 },
        { id: "b", views: 500, conversions: 30 },
      ]),
    ).toBe("a");
  });

  it("empate técnico não declara vencedora", () => {
    expect(
      pickWinner([
        { id: "a", views: 500, conversions: 50 },
        { id: "b", views: 500, conversions: 48 },
      ]),
    ).toBeNull();
  });
});
