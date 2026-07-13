import type { QueueName } from "@sales4u/core";
import { ANALYST_JOBS, CAMPAIGN_JOBS, POST_SALE_JOBS } from "./payloads.js";

/**
 * Jobs repetíveis (cron) do worker. Usa upsertJobScheduler do BullMQ:
 * idempotente — re-registrar no boot atualiza o scheduler existente.
 */

/** Fuso de referência do produto (horários "07:00" são horário de Brasília). */
export const REPEATABLE_TIMEZONE = "America/Sao_Paulo";

/** Contrato mínimo usado aqui — bullmq.Queue o satisfaz; testes injetam fakes. */
export interface SchedulerQueue {
  upsertJobScheduler(
    schedulerId: string,
    repeat: { pattern: string; tz?: string },
    template: { name: string; data: Record<string, never> },
  ): Promise<unknown>;
}

export interface RepeatableSchedule {
  queue: QueueName;
  schedulerId: string;
  /** Expressão cron (5 campos). */
  pattern: string;
  jobName: string;
}

export const REPEATABLE_SCHEDULES: readonly RepeatableSchedule[] = [
  {
    queue: "analyst",
    schedulerId: "analyst-daily-report",
    pattern: "0 7 * * *",
    jobName: ANALYST_JOBS.dailyReport,
  },
  {
    queue: "post-sale",
    schedulerId: "post-sale-daily-classification",
    pattern: "0 8 * * *",
    jobName: POST_SALE_JOBS.dailyClassification,
  },
  {
    queue: "campaign",
    schedulerId: "campaign-scheduler-tick",
    pattern: "*/5 * * * *",
    jobName: CAMPAIGN_JOBS.schedulerTick,
  },
];

/** Registra (ou atualiza) todos os schedulers repetíveis nas filas. */
export async function scheduleRepeatables(
  queues: Record<QueueName, SchedulerQueue>,
): Promise<void> {
  for (const item of REPEATABLE_SCHEDULES) {
    const queue = queues[item.queue];
    if (!queue) throw new Error(`Fila não registrada para repetível: ${item.queue}`);
    await queue.upsertJobScheduler(
      item.schedulerId,
      { pattern: item.pattern, tz: REPEATABLE_TIMEZONE },
      { name: item.jobName, data: {} },
    );
  }
}
