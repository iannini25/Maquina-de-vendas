import { describe, expect, it } from "vitest";
import { InstagramProvider, NotImplementedError, WhatsAppCloudProvider } from "./stubs.js";

describe("provedores stub", () => {
  it("InstagramProvider rejeita com NotImplementedError e mensagem clara", async () => {
    const provider = new InstagramProvider();
    await expect(provider.sendText("123", "oi")).rejects.toThrow(NotImplementedError);
    await expect(provider.sendText("123", "oi")).rejects.toThrow("Instagram: em breve");
    await expect(provider.getConnectionState()).rejects.toThrow("Instagram: em breve");
  });

  it("WhatsAppCloudProvider rejeita com NotImplementedError e mensagem clara", async () => {
    const provider = new WhatsAppCloudProvider();
    await expect(provider.sendImage("123", "https://x/img.png")).rejects.toThrow(
      NotImplementedError,
    );
    await expect(provider.ensureInstance()).rejects.toThrow("WhatsApp Cloud API: em breve");
  });
});
