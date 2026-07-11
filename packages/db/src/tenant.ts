import { Prisma } from "@prisma/client";

import { prisma } from "./client.js";

/**
 * REGRA DE OURO do multi-tenant: toda query de negócio passa por `tenantDb(workspaceId)`.
 * O client estendido injeta o filtro de workspace em leituras/mutações em massa,
 * valida o dono em mutações por id e carimba `workspaceId` em creates.
 * Modelos-filhos (sem coluna workspaceId) são guardados pela relação com o pai.
 */

export class TenantViolationError extends Error {
  constructor(model: string, operation: string) {
    super(`Acesso negado: ${operation} em ${model} fora do workspace atual`);
    this.name = "TenantViolationError";
  }
}

const DIRECT_TENANT_MODELS = new Set<string>([
  "Workspace",
  "Credential",
  "SetupState",
  "ProductOffer",
  "ContextFile",
  "AgentPersona",
  "AgentMode",
  "Campaign",
  "Ad",
  "LandingPage",
  "Template",
  "PipelineStage",
  "StagePlaybook",
  "Lead",
  "Note",
  "Task",
  "Deal",
  "Conversation",
  "AutomationFlow",
  "Approval",
  "Order",
  "AccessGrant",
  "Expense",
  "EmailTemplate",
  "ProspectList",
  "EventLog",
  "WebhookEndpoint",
  "AiUsage",
]);

/** Modelos sem coluna workspaceId: filtro via relação com o pai. */
const CHILD_GUARDS: Record<
  string,
  (workspaceId: string) => Record<string, unknown>
> = {
  Message: (w) => ({ conversation: { workspaceId: w } }),
  ContextChunk: (w) => ({ contextFile: { workspaceId: w } }),
  LandingVariant: (w) => ({ landingPage: { workspaceId: w } }),
  LandingEvent: (w) => ({ landingPage: { workspaceId: w } }),
  Prospect: (w) => ({ list: { workspaceId: w } }),
  Outreach: (w) => ({ prospect: { list: { workspaceId: w } } }),
  AutomationRun: (w) => ({ lead: { workspaceId: w } }),
  UsageEvent: (w) => ({ accessGrant: { workspaceId: w } }),
};

/** Pai a validar quando um filho é criado: campo FK → delegate + where do pai. */
const CHILD_PARENTS: Record<
  string,
  { fkField: string; check: (fk: string, workspaceId: string) => Promise<boolean> }[]
> = {
  Message: [
    {
      fkField: "conversationId",
      check: async (fk, w) =>
        (await prisma.conversation.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  ContextChunk: [
    {
      fkField: "contextFileId",
      check: async (fk, w) =>
        (await prisma.contextFile.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  LandingVariant: [
    {
      fkField: "landingPageId",
      check: async (fk, w) =>
        (await prisma.landingPage.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  LandingEvent: [
    {
      fkField: "landingPageId",
      check: async (fk, w) =>
        (await prisma.landingPage.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  Prospect: [
    {
      fkField: "listId",
      check: async (fk, w) =>
        (await prisma.prospectList.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  Outreach: [
    {
      fkField: "prospectId",
      check: async (fk, w) =>
        (await prisma.prospect.count({
          where: { id: fk, list: { workspaceId: w } },
        })) > 0,
    },
  ],
  AutomationRun: [
    {
      fkField: "leadId",
      check: async (fk, w) =>
        (await prisma.lead.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
    {
      fkField: "flowId",
      check: async (fk, w) =>
        (await prisma.automationFlow.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
  UsageEvent: [
    {
      fkField: "accessGrantId",
      check: async (fk, w) =>
        (await prisma.accessGrant.count({ where: { id: fk, workspaceId: w } })) > 0,
    },
  ],
};

const READ_MANY_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

const BY_ID_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

function guardFor(model: string, workspaceId: string): Record<string, unknown> | null {
  if (model === "Workspace") return { id: workspaceId };
  if (DIRECT_TENANT_MODELS.has(model)) return { workspaceId };
  const child = CHILD_GUARDS[model];
  if (child) return child(workspaceId);
  return null;
}

async function assertParentsInTenant(
  model: string,
  data: Record<string, unknown>,
  workspaceId: string,
  operation: string,
): Promise<void> {
  const parents = CHILD_PARENTS[model];
  if (!parents) return;
  for (const { fkField, check } of parents) {
    const fk = data[fkField];
    if (typeof fk === "string" && !(await check(fk, workspaceId))) {
      throw new TenantViolationError(model, operation);
    }
  }
}

export function tenantDb(workspaceId: string) {
  if (!workspaceId) throw new Error("tenantDb exige workspaceId");

  return prisma.$extends({
    name: `tenant:${workspaceId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const guard = guardFor(model, workspaceId);
          if (!guard) return query(args);

          const a = (args ?? {}) as QueryArgs;
          const isDirect = DIRECT_TENANT_MODELS.has(model) && model !== "Workspace";

          if (READ_MANY_OPS.has(operation)) {
            a.where = a.where ? { AND: [guard, a.where] } : guard;
            return query(a as typeof args);
          }

          if (operation === "create" || operation === "createMany") {
            const stamp = (d: Record<string, unknown>) => {
              if (isDirect && d["workspaceId"] === undefined) d["workspaceId"] = workspaceId;
              if (isDirect && d["workspaceId"] !== workspaceId) {
                throw new TenantViolationError(model, operation);
              }
              return d;
            };
            if (Array.isArray(a.data)) {
              for (const d of a.data) {
                stamp(d);
                await assertParentsInTenant(model, d, workspaceId, operation);
              }
            } else if (a.data) {
              stamp(a.data);
              await assertParentsInTenant(model, a.data, workspaceId, operation);
            }
            return query(a as typeof args);
          }

          if (BY_ID_OPS.has(operation)) {
            // upsert cria quando não existe: carimba o create também.
            if (operation === "upsert" && a.create) {
              if (isDirect && a.create["workspaceId"] === undefined) {
                a.create["workspaceId"] = workspaceId;
              }
              await assertParentsInTenant(model, a.create, workspaceId, operation);
            }
            const delegate = (
              prisma as unknown as Record<
                string,
                { findFirst: (q: { where: unknown; select: { id: true } }) => Promise<{ id: string } | null> }
              >
            )[model.charAt(0).toLowerCase() + model.slice(1)];
            if (a.where && delegate) {
              const existing = await delegate.findFirst({
                where: { AND: [guard, a.where] },
                select: { id: true },
              });
              const mustExist = operation !== "findUnique" && operation !== "upsert";
              if (!existing && mustExist) {
                throw new TenantViolationError(model, operation);
              }
              if (!existing && operation === "findUnique") {
                return null;
              }
            }
            return query(a as typeof args);
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
export type { Prisma };
