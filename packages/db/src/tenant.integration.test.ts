import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "./client.js";
import { tenantDb, TenantViolationError } from "./tenant.js";

/**
 * Teste de vazamento entre tenants (integração — precisa de DATABASE_URL).
 * Se houver QUALQUER furo no tenantDb, estes testes ficam vermelhos.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

const suffix = randomBytes(4).toString("hex");
const SLUG_A = `tenant-a-${suffix}`;
const SLUG_B = `tenant-b-${suffix}`;

let workspaceA: string;
let workspaceB: string;
let stageA: string;
let stageB: string;
let leadA: string;
let leadB: string;
let conversationB: string;

suite("isolamento multi-tenant (tenantDb)", () => {
  beforeAll(async () => {
    const a = await prisma.workspace.create({
      data: { name: "Tenant A", slug: SLUG_A },
    });
    const b = await prisma.workspace.create({
      data: { name: "Tenant B", slug: SLUG_B },
    });
    workspaceA = a.id;
    workspaceB = b.id;

    stageA = (
      await prisma.pipelineStage.create({
        data: { workspaceId: workspaceA, name: "Novo", order: 0 },
      })
    ).id;
    stageB = (
      await prisma.pipelineStage.create({
        data: { workspaceId: workspaceB, name: "Novo", order: 0 },
      })
    ).id;

    leadA = (
      await prisma.lead.create({
        data: { workspaceId: workspaceA, name: "Lead A", phone: `55119${suffix}1`, stageId: stageA },
      })
    ).id;
    leadB = (
      await prisma.lead.create({
        data: { workspaceId: workspaceB, name: "Lead B", phone: `55119${suffix}2`, stageId: stageB },
      })
    ).id;

    conversationB = (
      await prisma.conversation.create({
        data: { workspaceId: workspaceB, leadId: leadB },
      })
    ).id;
    await prisma.message.create({
      data: {
        conversationId: conversationB,
        direction: "IN",
        authorType: "LEAD",
        content: { text: "segredo do tenant B" },
      },
    });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { slug: { in: [SLUG_A, SLUG_B] } },
    });
    await prisma.$disconnect();
  });

  it("findMany não vaza leads de outro tenant", async () => {
    const db = tenantDb(workspaceA);
    const leads = await db.lead.findMany();
    expect(leads.map((l) => l.id)).toContain(leadA);
    expect(leads.map((l) => l.id)).not.toContain(leadB);
  });

  it("findUnique por id de outro tenant retorna null", async () => {
    const db = tenantDb(workspaceA);
    const lead = await db.lead.findUnique({ where: { id: leadB } });
    expect(lead).toBeNull();
  });

  it("update em lead de outro tenant é bloqueado", async () => {
    const db = tenantDb(workspaceA);
    await expect(
      db.lead.update({ where: { id: leadB }, data: { name: "hackeado" } }),
    ).rejects.toThrow(TenantViolationError);
    const untouched = await prisma.lead.findUnique({ where: { id: leadB } });
    expect(untouched?.name).toBe("Lead B");
  });

  it("delete em lead de outro tenant é bloqueado", async () => {
    const db = tenantDb(workspaceA);
    await expect(db.lead.delete({ where: { id: leadB } })).rejects.toThrow(
      TenantViolationError,
    );
  });

  it("updateMany sem filtro só atinge o próprio tenant", async () => {
    const db = tenantDb(workspaceA);
    await db.lead.updateMany({ data: { score: 99 } });
    const b = await prisma.lead.findUnique({ where: { id: leadB } });
    expect(b?.score).toBe(0);
    const a = await prisma.lead.findUnique({ where: { id: leadA } });
    expect(a?.score).toBe(99);
  });

  it("create carimba o workspaceId do tenant e rejeita workspaceId alheio", async () => {
    const db = tenantDb(workspaceA);
    const created = await db.note.create({
      data: { leadId: leadA, text: "nota", workspaceId: workspaceA },
    });
    expect(created.workspaceId).toBe(workspaceA);

    await expect(
      db.note.create({
        data: { leadId: leadB, text: "invasão", workspaceId: workspaceB },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("modelo-filho (Message) não vaza pela relação", async () => {
    const db = tenantDb(workspaceA);
    const messages = await db.message.findMany();
    expect(messages).toHaveLength(0);
  });

  it("criar Message apontando conversa de outro tenant é bloqueado", async () => {
    const db = tenantDb(workspaceA);
    await expect(
      db.message.create({
        data: {
          conversationId: conversationB,
          direction: "OUT",
          authorType: "HUMAN",
          content: { text: "injetada" },
        },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("count/aggregate respeitam o tenant", async () => {
    const dbA = tenantDb(workspaceA);
    const dbB = tenantDb(workspaceB);
    expect(await dbA.lead.count()).toBe(1);
    expect(await dbB.lead.count()).toBe(1);
  });
});
