import { getQueue, QUEUES } from "@/lib/queues";

/**
 * Lembretes de campanha Lançamento/Live: sequência fixa T-1d · T-3h · T-15min
 * antes do horário da live, executada pelo worker via fila `campaign`.
 */

export interface LiveReminderStage {
  stage: string;
  label: string;
  offsetMs: number;
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

export const LIVE_REMINDER_STAGES: readonly LiveReminderStage[] = [
  { stage: "t-1d", label: "T-1d — lembrete “amanhã é a live”", offsetMs: 24 * HOUR },
  { stage: "t-3h", label: "T-3h — lembrete “hoje tem live”", offsetMs: 3 * HOUR },
  { stage: "t-15min", label: "T-15min — “estamos começando”", offsetMs: 15 * MINUTE },
];

function reminderJobId(campaignId: string, stage: string): string {
  return `live-reminder-${campaignId}-${stage}`;
}

/**
 * (Re)agenda os lembretes da live com delay real até cada estágio.
 * Remove agendamentos anteriores da campanha antes (edição de data/toggle).
 */
export async function scheduleLiveReminders(input: {
  workspaceId: string;
  campaignId: string;
  liveAt: Date | null;
  enabled: boolean;
}): Promise<void> {
  const queue = getQueue(QUEUES.campaign);

  await Promise.all(
    LIVE_REMINDER_STAGES.map((s) =>
      queue.remove(reminderJobId(input.campaignId, s.stage)).catch(() => 0),
    ),
  );

  if (!input.enabled || !input.liveAt) return;

  const liveAtMs = input.liveAt.getTime();
  for (const s of LIVE_REMINDER_STAGES) {
    const delay = liveAtMs - s.offsetMs - Date.now();
    if (delay <= 0) continue; // estágio já passou — não agenda no passado
    await queue.add(
      "live_reminder",
      {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        kind: "live_reminder",
        stage: s.stage,
      },
      { delay, jobId: reminderJobId(input.campaignId, s.stage) },
    );
  }
}
