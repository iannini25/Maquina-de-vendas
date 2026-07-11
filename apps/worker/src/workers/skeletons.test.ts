import { describe, expect, it } from "vitest";
import { NotImplementedYetError } from "../errors.js";
import type { JobProcessor, Log } from "../types.js";
import { createAgentReplyProcessor } from "./agent-reply.js";
import { createAnalystProcessor } from "./analyst.js";
import { createAutomationProcessor } from "./automation.js";
import { createCampaignProcessor } from "./campaign.js";
import { createContextIngestProcessor } from "./context-ingest.js";
import { createImportProcessor } from "./import.js";
import { createPostSaleProcessor } from "./post-sale.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

interface SkeletonCase {
  queue: string;
  processor: JobProcessor;
  jobName: string;
  validData: unknown;
  invalidData: unknown;
}

const cases: SkeletonCase[] = [
  {
    queue: "automation",
    processor: createAutomationProcessor({ log: silentLog }),
    jobName: "run-step",
    validData: { workspaceId: "ws", runId: "run" },
    invalidData: { workspaceId: "ws" },
  },
  {
    queue: "agent-reply",
    processor: createAgentReplyProcessor({ log: silentLog }),
    jobName: "reply",
    validData: { workspaceId: "ws", conversationId: "conv", messageId: "msg" },
    invalidData: { workspaceId: "ws" },
  },
  {
    queue: "context-ingest",
    processor: createContextIngestProcessor({ log: silentLog }),
    jobName: "ingest-file",
    validData: { workspaceId: "ws", contextFileId: "cf" },
    invalidData: { workspaceId: "ws" },
  },
  {
    queue: "post-sale",
    processor: createPostSaleProcessor({ log: silentLog }),
    jobName: "daily-classification",
    validData: {},
    invalidData: { workspaceId: "" },
  },
  {
    queue: "campaign",
    processor: createCampaignProcessor({ log: silentLog }),
    jobName: "scheduler-tick",
    validData: {},
    invalidData: { intruso: true },
  },
  {
    queue: "analyst",
    processor: createAnalystProcessor({ log: silentLog }),
    jobName: "daily-report",
    validData: {},
    invalidData: { date: "10-07-2026" },
  },
  {
    queue: "import",
    processor: createImportProcessor({ log: silentLog }),
    jobName: "csv",
    validData: { workspaceId: "ws", storageKey: "imports/x.csv", entity: "leads" },
    invalidData: { workspaceId: "ws", storageKey: "x", entity: "orders" },
  },
];

describe("handlers esqueleto", () => {
  for (const item of cases) {
    it(`${item.queue}: valida o payload e lança NotImplementedYetError`, async () => {
      await expect(
        item.processor({ name: item.jobName, data: item.validData }),
      ).rejects.toBeInstanceOf(NotImplementedYetError);
    });

    it(`${item.queue}: rejeita payload inválido com erro de validação`, async () => {
      const failure = item
        .processor({ name: item.jobName, data: item.invalidData })
        .then(() => null)
        .catch((error: unknown) => error);
      const error = await failure;
      expect(error).not.toBeNull();
      expect(error).not.toBeInstanceOf(NotImplementedYetError);
    });

    it(`${item.queue}: lança NotImplementedYetError para job.name desconhecido`, async () => {
      await expect(
        item.processor({ name: "job-inexistente", data: item.validData }),
      ).rejects.toBeInstanceOf(NotImplementedYetError);
    });
  }
});
