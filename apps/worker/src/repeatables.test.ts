import { describe, expect, it } from "vitest";
import type { QueueName } from "@vendaflow/core";
import {
  REPEATABLE_SCHEDULES,
  REPEATABLE_TIMEZONE,
  scheduleRepeatables,
  type SchedulerQueue,
} from "./repeatables.js";

interface UpsertCall {
  queue: string;
  schedulerId: string;
  pattern: string;
  tz?: string;
  jobName: string;
}

function makeFakeQueues(): { queues: Record<QueueName, SchedulerQueue>; calls: UpsertCall[] } {
  const calls: UpsertCall[] = [];
  const makeQueue = (queue: string): SchedulerQueue => ({
    async upsertJobScheduler(schedulerId, repeat, template) {
      calls.push({ queue, schedulerId, pattern: repeat.pattern, tz: repeat.tz, jobName: template.name });
      return {};
    },
  });
  const queues = {
    "automation": makeQueue("automation"),
    "agent-reply": makeQueue("agent-reply"),
    "context-ingest": makeQueue("context-ingest"),
    "email": makeQueue("email"),
    "outbound": makeQueue("outbound"),
    "post-sale": makeQueue("post-sale"),
    "campaign": makeQueue("campaign"),
    "analyst": makeQueue("analyst"),
    "import": makeQueue("import"),
  } satisfies Record<QueueName, SchedulerQueue>;
  return { queues, calls };
}

describe("scheduleRepeatables", () => {
  it("registra analyst diário às 07:00, post-sale às 08:00 e campaign a cada 5min", async () => {
    const { queues, calls } = makeFakeQueues();
    await scheduleRepeatables(queues);

    expect(calls).toEqual([
      {
        queue: "analyst",
        schedulerId: "analyst-daily-report",
        pattern: "0 7 * * *",
        tz: REPEATABLE_TIMEZONE,
        jobName: "daily-report",
      },
      {
        queue: "post-sale",
        schedulerId: "post-sale-daily-classification",
        pattern: "0 8 * * *",
        tz: REPEATABLE_TIMEZONE,
        jobName: "daily-classification",
      },
      {
        queue: "campaign",
        schedulerId: "campaign-scheduler-tick",
        pattern: "*/5 * * * *",
        tz: REPEATABLE_TIMEZONE,
        jobName: "scheduler-tick",
      },
    ]);
  });

  it("todo agendamento usa cron de 5 campos e id único", () => {
    const ids = REPEATABLE_SCHEDULES.map((item) => item.schedulerId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of REPEATABLE_SCHEDULES) {
      expect(item.pattern.trim().split(/\s+/)).toHaveLength(5);
    }
  });
});
