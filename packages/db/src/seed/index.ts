import { STAGE_SEEDS } from "@sales4u/core";
import bcrypt from "bcryptjs";

import { prisma } from "../client.js";
import { seedDemoData } from "./demo-data.js";

/**
 * Seed do banco (SEED_DEMO=true): workspace demo completo com estágios,
 * playbooks, produto, leads de exemplo, conversas, campanhas, landing,
 * despesas, vendas e templates.
 */
async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO != true — nada a fazer.");
    return;
  }

  const existing = await prisma.workspace.findUnique({ where: { slug: "lideranca-ia" } });
  if (existing) {
    console.log("Workspace demo já existe — seed idempotente, nada a fazer.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 12);

  const workspace = await prisma.workspace.create({
    data: { name: "Liderança IA", slug: "lideranca-ia" },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@sales4u.local" },
    update: {},
    create: { name: "Demo Sales4U", email: "demo@sales4u.local", passwordHash },
  });

  await prisma.membership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
  });

  await prisma.setupState.create({
    data: {
      workspaceId: workspace.id,
      checklist: { demo: true },
      completedAt: new Date(),
    },
  });

  // Estágios + playbooks a partir do seed canônico do core
  const stageIdByKey = new Map<string, string>();
  for (let i = 0; i < STAGE_SEEDS.length; i++) {
    const seed = STAGE_SEEDS[i]!;
    const stage = await prisma.pipelineStage.create({
      data: {
        workspaceId: workspace.id,
        name: seed.name,
        order: i,
        color: seed.color,
        isFixed: seed.isFixed,
        systemKey: seed.systemKey ?? null,
      },
    });
    stageIdByKey.set(seed.key, stage.id);

    await prisma.stagePlaybook.create({
      data: {
        workspaceId: workspace.id,
        stageId: stage.id,
        source: "PLATFORM",
        objective: seed.playbook.objective,
        instructions: seed.playbook.instructions,
        allowedActions: seed.playbook.allowedActions,
        advanceWhen: seed.playbook.advanceWhen,
        regressWhen: seed.playbook.regressWhen,
        cadence: seed.playbook.cadence as object,
        handoffTriggers: seed.playbook.handoffTriggers,
        autonomy: seed.playbook.autonomy,
      },
    });
  }

  await seedDemoData(prisma, { workspaceId: workspace.id, userId: user.id, stageIdByKey });

  console.log("Seed concluído:");
  console.log("  workspace: Liderança IA (lideranca-ia)");
  console.log("  login: demo@sales4u.local / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
