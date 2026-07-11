import { describe, expect, it } from "vitest";

import { NotImplementedYetError } from "../errors.js";
import type { Log } from "../types.js";
import {
  createImportProcessor,
  detectDelimiter,
  mapHeaders,
  parseCsv,
  parseValueCents,
  type ImportDb,
  type ImportDeps,
  type ImportEvent,
  type NewLeadInput,
  type NewProspectInput,
} from "./import.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

// ── parseCsv ────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parseia CSV simples com vírgula e CRLF", () => {
    expect(parseCsv("nome,telefone\r\nAna,11999998888\r\nBia,21988887777\r\n")).toEqual([
      ["nome", "telefone"],
      ["Ana", "11999998888"],
      ["Bia", "21988887777"],
    ]);
  });

  it("respeita aspas: delimitador e aspas escapadas dentro do campo", () => {
    expect(parseCsv('nome,empresa\n"Silva, Ana","Acme ""Corp"""')).toEqual([
      ["nome", "empresa"],
      ["Silva, Ana", 'Acme "Corp"'],
    ]);
  });

  it("detecta ponto-e-vírgula como delimitador", () => {
    expect(detectDelimiter("nome;telefone;email\n")).toBe(";");
    expect(parseCsv("nome;valor\nAna;R$ 1.997,00")).toEqual([
      ["nome", "valor"],
      ["Ana", "R$ 1.997,00"],
    ]);
  });

  it("remove o BOM do início do arquivo", () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + "nome,telefone\nAna,11999998888")).toEqual([
      ["nome", "telefone"],
      ["Ana", "11999998888"],
    ]);
  });

  it("preserva quebra de linha dentro de campo entre aspas", () => {
    expect(parseCsv('nome,obs\n"Ana","linha 1\nlinha 2"\nBia,ok')).toEqual([
      ["nome", "obs"],
      ["Ana", "linha 1\nlinha 2"],
      ["Bia", "ok"],
    ]);
  });

  it("descarta linhas totalmente vazias", () => {
    expect(parseCsv("nome,telefone\n\nAna,11999998888\n,,\n")).toEqual([
      ["nome", "telefone"],
      ["Ana", "11999998888"],
    ]);
  });
});

// ── mapHeaders / parseValueCents ────────────────────────────────────────────

describe("mapHeaders", () => {
  it("mapeia nomes flexíveis com acento, caixa e variações", () => {
    const mapa = mapHeaders(["Nome", "WhatsApp", "E-mail", "EMPRESA", "Cargo", "Origem", "Valor"]);
    expect(mapa).toEqual({ name: 0, phone: 1, email: 2, company: 3, role: 4, source: 5, value: 6 });
  });

  it("retorna vazio quando nenhuma coluna é reconhecida", () => {
    expect(mapHeaders(["foo", "bar"])).toEqual({});
  });
});

describe("parseValueCents", () => {
  it("entende formato brasileiro, decimal americano e inteiro", () => {
    expect(parseValueCents("R$ 1.997,00")).toBe(199_700);
    expect(parseValueCents("49,9")).toBe(4990);
    expect(parseValueCents("1234.56")).toBe(123_456);
    expect(parseValueCents("1997")).toBe(199_700);
  });

  it("retorna null para lixo ou negativo", () => {
    expect(parseValueCents("abc")).toBeNull();
    expect(parseValueCents("-10")).toBeNull();
  });
});

// ── Fakes ───────────────────────────────────────────────────────────────────

class FakeImportDb implements ImportDb {
  stageId: string | null = "stage_new";
  telefonesExistentes: string[] = [];
  listasValidas = new Set<string>();
  telefonesDeProspects: string[] = [];

  leadsCriados: NewLeadInput[] = [];
  prospectsCriados: NewProspectInput[] = [];
  eventos: ImportEvent[] = [];
  falharNoTelefone: string | null = null;

  async getNewStageId(): Promise<string | null> {
    return this.stageId;
  }

  async findExistingLeadPhones(_workspaceId: string, phones: readonly string[]): Promise<string[]> {
    return this.telefonesExistentes.filter((phone) => phones.includes(phone));
  }

  async createLeadWithConversation(input: NewLeadInput): Promise<void> {
    if (input.phone === this.falharNoTelefone) throw new Error("banco indisponível");
    this.leadsCriados.push(input);
  }

  async prospectListBelongsToWorkspace(_workspaceId: string, listId: string): Promise<boolean> {
    return this.listasValidas.has(listId);
  }

  async findExistingProspectPhones(): Promise<string[]> {
    return this.telefonesDeProspects;
  }

  async createProspect(input: NewProspectInput): Promise<void> {
    this.prospectsCriados.push(input);
  }

  async logEvent(event: ImportEvent): Promise<void> {
    this.eventos.push(event);
  }
}

function makeHarness(
  db: FakeImportDb,
  csv: string,
): {
  deps: ImportDeps;
  notificacoes: Array<{ workspaceId: string; payload: Record<string, unknown> }>;
  chavesBaixadas: string[];
} {
  const notificacoes: Array<{ workspaceId: string; payload: Record<string, unknown> }> = [];
  const chavesBaixadas: string[] = [];
  const deps: ImportDeps = {
    db,
    getObject: async (key) => {
      chavesBaixadas.push(key);
      return Buffer.from(csv, "utf8");
    },
    publishNotify: async (workspaceId, payload) => {
      notificacoes.push({ workspaceId, payload });
    },
    log: silentLog,
  };
  return { deps, notificacoes, chavesBaixadas };
}

const jobLeads = {
  name: "csv",
  data: { workspaceId: "ws_1", storageKey: "imports/leads.csv", entity: "leads" },
};

// ── entity=leads ────────────────────────────────────────────────────────────

describe("import csv (leads)", () => {
  it("cria leads válidos com telefone normalizado, estágio NEW e conversa", async () => {
    const db = new FakeImportDb();
    const { deps } = makeHarness(
      db,
      "nome,whatsapp,email,empresa,origem,valor\nAna,(11) 99999-8888,ana@x.com,Acme,facebook,1997\n",
    );

    await createImportProcessor(deps)(jobLeads);

    expect(db.leadsCriados).toEqual([
      {
        workspaceId: "ws_1",
        stageId: "stage_new",
        name: "Ana",
        phone: "5511999998888",
        email: "ana@x.com",
        source: "facebook",
        valueCents: 199_700,
        tags: ["empresa: Acme"],
      },
    ]);
  });

  it("deduplica por telefone: existentes no workspace e repetidos no arquivo são pulados", async () => {
    const db = new FakeImportDb();
    db.telefonesExistentes = ["5511999998888"];
    const { deps } = makeHarness(
      db,
      [
        "nome,telefone",
        "Ana,11999998888", // já existe no workspace → pulado
        "Bia,21988887777", // criado
        "Bia de novo,(21) 98888-7777", // repetido no arquivo → pulado
        "Carla,", // sem telefone → erro
      ].join("\n"),
    );

    await createImportProcessor(deps)(jobLeads);

    expect(db.leadsCriados.map((lead) => lead.phone)).toEqual(["5521988887777"]);
    const evento = db.eventos[0];
    expect(evento?.type).toBe("import.finished");
    expect(evento?.data).toMatchObject({ total: 4, criados: 1, pulados: 2 });
    expect(evento?.data.erros).toEqual([{ linha: 5, motivo: "telefone ausente" }]);
  });

  it("registra EventLog import.finished e publica SSE import_finished", async () => {
    const db = new FakeImportDb();
    const { deps, notificacoes, chavesBaixadas } = makeHarness(db, "nome,telefone\nAna,11999998888\n");

    await createImportProcessor(deps)(jobLeads);

    expect(chavesBaixadas).toEqual(["imports/leads.csv"]);
    expect(db.eventos).toHaveLength(1);
    expect(db.eventos[0]).toMatchObject({
      workspaceId: "ws_1",
      type: "import.finished",
      entity: "Import",
      entityId: "imports/leads.csv",
    });
    expect(notificacoes).toEqual([
      {
        workspaceId: "ws_1",
        payload: {
          kind: "import_finished",
          entity: "leads",
          storageKey: "imports/leads.csv",
          total: 1,
          criados: 1,
          pulados: 0,
          erros: 0,
        },
      },
    ]);
  });

  it("falha por linha não derruba o job: vira erro no relatório", async () => {
    const db = new FakeImportDb();
    db.falharNoTelefone = "5521988887777";
    const { deps } = makeHarness(db, "nome,telefone\nAna,11999998888\nBia,21988887777\n");

    await createImportProcessor(deps)(jobLeads);

    expect(db.leadsCriados).toHaveLength(1);
    expect(db.eventos[0]?.data).toMatchObject({ criados: 1, pulados: 0 });
    expect(db.eventos[0]?.data.erros).toEqual([{ linha: 3, motivo: "banco indisponível" }]);
  });

  it("cabeçalho sem coluna de telefone fecha com relatório de falha (sem lançar)", async () => {
    const db = new FakeImportDb();
    const { deps } = makeHarness(db, "nome,email\nAna,ana@x.com\n");

    await expect(createImportProcessor(deps)(jobLeads)).resolves.toBeUndefined();

    expect(db.leadsCriados).toHaveLength(0);
    expect(db.eventos[0]?.data).toMatchObject({ criados: 0 });
    expect(db.eventos[0]?.data.erros).toEqual([
      { linha: 0, motivo: "coluna de telefone/whatsapp não encontrada no cabeçalho" },
    ]);
  });

  it("erro ao baixar do bucket propaga para o retry do BullMQ", async () => {
    const db = new FakeImportDb();
    const { deps } = makeHarness(db, "");
    deps.getObject = async () => {
      throw new Error("minio fora do ar");
    };

    await expect(createImportProcessor(deps)(jobLeads)).rejects.toThrowError("minio fora do ar");
    expect(db.eventos).toHaveLength(0);
  });
});

// ── entity=prospects ────────────────────────────────────────────────────────

describe("import csv (prospects)", () => {
  const jobProspects = {
    name: "csv",
    data: {
      workspaceId: "ws_1",
      storageKey: "imports/prospects.csv",
      entity: "prospects",
      prospectListId: "lista_1",
    },
  };

  it("cria prospects na lista com empresa/cargo e deduplica por telefone", async () => {
    const db = new FakeImportDb();
    db.listasValidas.add("lista_1");
    db.telefonesDeProspects = ["5511999998888"];
    const { deps } = makeHarness(
      db,
      "nome;empresa;cargo;telefone;email\nAna;Acme;CEO;11999998888;ana@x.com\nBia;Beta;CTO;21988887777;\n",
    );

    await createImportProcessor(deps)(jobProspects);

    expect(db.prospectsCriados).toEqual([
      {
        listId: "lista_1",
        name: "Bia",
        company: "Beta",
        role: "CTO",
        phone: "5521988887777",
        email: null,
      },
    ]);
    expect(db.eventos[0]?.data).toMatchObject({ total: 2, criados: 1, pulados: 1 });
  });

  it("prospects sem prospectListId fecha com relatório de falha (sem lançar)", async () => {
    const db = new FakeImportDb();
    const { deps, notificacoes } = makeHarness(db, "nome\nAna\n");

    await createImportProcessor(deps)({
      name: "csv",
      data: { workspaceId: "ws_1", storageKey: "imports/p.csv", entity: "prospects" },
    });

    expect(db.prospectsCriados).toHaveLength(0);
    expect(db.eventos[0]?.data.erros).toEqual([
      { linha: 0, motivo: "prospectListId ausente para importação de prospects" },
    ]);
    expect(notificacoes[0]?.payload).toMatchObject({ kind: "import_finished", erros: 1 });
  });

  it("lista que não pertence ao workspace fecha com relatório de falha", async () => {
    const db = new FakeImportDb();
    const { deps } = makeHarness(db, "nome\nAna\n");

    await createImportProcessor(deps)(jobProspects);

    expect(db.prospectsCriados).toHaveLength(0);
    expect(db.eventos[0]?.data.erros).toEqual([
      { linha: 0, motivo: "lista de prospects não encontrada no workspace" },
    ]);
  });
});

describe("createImportProcessor", () => {
  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeHarness(new FakeImportDb(), "");
    await expect(
      createImportProcessor(deps)({ name: "xls", data: jobLeads.data }),
    ).rejects.toBeInstanceOf(NotImplementedYetError);
  });

  it("rejeita payload inválido com erro de validação", async () => {
    const { deps } = makeHarness(new FakeImportDb(), "");
    await expect(
      createImportProcessor(deps)({
        name: "csv",
        data: { workspaceId: "ws_1", storageKey: "x", entity: "orders" },
      }),
    ).rejects.toThrowError();
  });
});
