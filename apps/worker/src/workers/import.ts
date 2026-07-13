import { normalizePhone } from "@sales4u/messaging";

import { NotImplementedYetError } from "../errors.js";
import { IMPORT_JOBS, importJobSchema, type ImportJobPayload } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "import" — CSV de leads/prospects em lote.
 * Lógica pura com dependências injetadas; o wiring real (prisma, MinIO,
 * SSE) está em import.wiring.ts e é carregado sob demanda — testes com
 * deps completas nunca tocam banco/redis/S3.
 *
 * Fluxo do job "csv": baixa o arquivo do bucket, parseia (aspas, ,/;, BOM,
 * quebra de linha dentro de aspas), mapeia cabeçalhos por nome flexível,
 * cria Leads (dedupe por telefone no workspace) ou Prospects na lista e
 * fecha com EventLog import.finished + SSE notify import_finished.
 */

// ── Parse de CSV ────────────────────────────────────────────────────────────

export type CsvDelimiter = "," | ";";

/** Detecta o delimitador pela primeira linha (contagem fora de aspas). */
export function detectDelimiter(input: string): CsvDelimiter {
  const fimDaLinha = input.indexOf("\n");
  const primeiraLinha = fimDaLinha === -1 ? input : input.slice(0, fimDaLinha);
  let virgulas = 0;
  let pontosEVirgulas = 0;
  let dentroDeAspas = false;
  for (const caractere of primeiraLinha) {
    if (caractere === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas && caractere === ",") virgulas += 1;
    else if (!dentroDeAspas && caractere === ";") pontosEVirgulas += 1;
  }
  return pontosEVirgulas > virgulas ? ";" : ",";
}

/**
 * Parse robusto de CSV: BOM, aspas com `""` escapado, vírgula ou ponto-e-
 * vírgula, CRLF/CR/LF e quebra de linha dentro de campo entre aspas.
 * Linhas totalmente vazias são descartadas.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimitador = detectDelimiter(input);

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let dentroDeAspas = false;

  const fecharCampo = (): void => {
    linha.push(campo);
    campo = "";
  };
  const fecharLinha = (): void => {
    fecharCampo();
    linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const caractere = input[i];
    if (dentroDeAspas) {
      if (caractere === '"') {
        if (input[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += caractere;
      }
    } else if (caractere === '"') {
      dentroDeAspas = true;
    } else if (caractere === delimitador) {
      fecharCampo();
    } else if (caractere === "\n") {
      fecharLinha();
    } else if (caractere === "\r") {
      if (input[i + 1] !== "\n") fecharLinha(); // CR isolado também quebra linha
    } else {
      campo += caractere;
    }
  }
  if (campo.length > 0 || linha.length > 0) fecharLinha();

  return linhas.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

// ── Mapeamento flexível de cabeçalhos ───────────────────────────────────────

export type CsvField = "name" | "phone" | "email" | "company" | "role" | "source" | "value";

const ALIASES_DE_CABECALHO: Record<CsvField, readonly string[]> = {
  name: ["nome", "name", "nomecompleto", "fullname"],
  phone: ["whatsapp", "telefone", "phone", "celular", "fone", "tel"],
  email: ["email", "emailaddress"],
  company: ["empresa", "company", "organizacao"],
  role: ["cargo", "role", "funcao", "position"],
  source: ["origem", "source", "fonte"],
  value: ["valor", "value", "preco", "price"],
};

function normalizarCabecalho(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Mapeia cada campo canônico para o índice da coluna (primeira ocorrência). */
export function mapHeaders(headerRow: readonly string[]): Partial<Record<CsvField, number>> {
  const mapa: Partial<Record<CsvField, number>> = {};
  headerRow.forEach((header, indice) => {
    const normalizado = normalizarCabecalho(header);
    for (const [campo, aliases] of Object.entries(ALIASES_DE_CABECALHO) as Array<
      [CsvField, readonly string[]]
    >) {
      if (mapa[campo] === undefined && aliases.includes(normalizado)) {
        mapa[campo] = indice;
      }
    }
  });
  return mapa;
}

/** Converte "R$ 1.234,56" / "1234.56" / "1997" em centavos; null se ilegível. */
export function parseValueCents(raw: string): number | null {
  const limpo = raw.replace(/[^\d.,-]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

// ── Contratos das dependências (implementados pelo wiring / fakes) ──────────

export interface NewLeadInput {
  workspaceId: string;
  stageId: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  valueCents: number | null;
  tags: string[];
}

export interface NewProspectInput {
  listId: string;
  name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface ImportEvent {
  workspaceId: string;
  type: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
}

/** Porta de dados do import — o wiring implementa com prisma. */
export interface ImportDb {
  /** Estágio NEW do workspace (fallback: primeiro por ordem); null se não houver. */
  getNewStageId(workspaceId: string): Promise<string | null>;
  findExistingLeadPhones(workspaceId: string, phones: readonly string[]): Promise<string[]>;
  /** Cria o Lead já com a Conversation WHATSAPP inicial. */
  createLeadWithConversation(input: NewLeadInput): Promise<void>;
  prospectListBelongsToWorkspace(workspaceId: string, listId: string): Promise<boolean>;
  findExistingProspectPhones(listId: string): Promise<string[]>;
  createProspect(input: NewProspectInput): Promise<void>;
  logEvent(event: ImportEvent): Promise<void>;
}

export interface ImportDeps {
  db: ImportDb;
  /** Baixa o objeto do bucket (MinIO/S3). */
  getObject(key: string): Promise<Buffer>;
  /** Publica no canal SSE notify do workspace. */
  publishNotify(workspaceId: string, payload: Record<string, unknown>): Promise<void>;
  log: Log;
}

/** index.ts chama com { log }; testes injetam as deps completas. */
export type ImportOptions = { log: Log } & Partial<Omit<ImportDeps, "log">>;

export interface ImportError {
  linha: number;
  motivo: string;
}

export interface ImportReport {
  total: number;
  criados: number;
  pulados: number;
  erros: ImportError[];
}

/** Máximo de erros detalhados persistidos no EventLog. */
const MAX_ERROS_NO_RELATORIO = 50;

// ── Factory ─────────────────────────────────────────────────────────────────

/** Cria o processor da fila "import". */
export function createImportProcessor(options: ImportOptions): JobProcessor {
  let deps: ImportDeps | undefined;
  return async (job: JobLike): Promise<void> => {
    const payload = importJobSchema.parse(job.data);
    switch (job.name) {
      case IMPORT_JOBS.csv:
        deps ??= await resolveDeps(options);
        return importCsv(deps, payload);
      default:
        throw new NotImplementedYetError("import", job.name);
    }
  };
}

function temWiringCompleto(
  options: ImportOptions,
): options is ImportOptions & Omit<ImportDeps, "log"> {
  return (
    options.db !== undefined &&
    options.getObject !== undefined &&
    options.publishNotify !== undefined
  );
}

async function resolveDeps(options: ImportOptions): Promise<ImportDeps> {
  if (temWiringCompleto(options)) return options;
  const { createImportWiring } = await import("./import.wiring.js");
  const wiring = createImportWiring();
  return {
    log: options.log,
    db: options.db ?? wiring.db,
    getObject: options.getObject ?? wiring.getObject,
    publishNotify: options.publishNotify ?? wiring.publishNotify,
  };
}

// ── Job csv ─────────────────────────────────────────────────────────────────

async function importCsv(deps: ImportDeps, payload: ImportJobPayload): Promise<void> {
  // Falha ao baixar (rede/MinIO) propaga — o BullMQ faz retry.
  const arquivo = await deps.getObject(payload.storageKey);
  const linhas = parseCsv(arquivo.toString("utf8"));

  const relatorio = await gerarRelatorio(deps, payload, linhas);
  await finalizarImport(deps, payload, relatorio);
}

async function gerarRelatorio(
  deps: ImportDeps,
  payload: ImportJobPayload,
  linhas: string[][],
): Promise<ImportReport> {
  const [cabecalho, ...dados] = linhas;
  if (!cabecalho || dados.length === 0) {
    return falhaGeral(0, "CSV vazio ou sem linhas de dados");
  }

  const colunas = mapHeaders(cabecalho);
  if (colunas.name === undefined) {
    return falhaGeral(dados.length, "coluna de nome não encontrada no cabeçalho");
  }

  if (payload.entity === "leads") {
    if (colunas.phone === undefined) {
      return falhaGeral(dados.length, "coluna de telefone/whatsapp não encontrada no cabeçalho");
    }
    return importarLeads(deps, payload.workspaceId, dados, colunas);
  }
  return importarProspects(deps, payload, dados, colunas);
}

/** Falha de configuração: vira relatório (não relança — retry não resolve). */
function falhaGeral(total: number, motivo: string): ImportReport {
  return { total, criados: 0, pulados: 0, erros: [{ linha: 0, motivo }] };
}

interface LinhaLida {
  /** Linha no arquivo (cabeçalho = 1; linhas vazias ignoradas). */
  linha: number;
  cells: readonly string[];
}

function celula(cells: readonly string[], indice: number | undefined): string {
  if (indice === undefined) return "";
  return (cells[indice] ?? "").trim();
}

function comoLinhas(dados: string[][]): LinhaLida[] {
  return dados.map((cells, i) => ({ linha: i + 2, cells }));
}

// ── entity=leads ────────────────────────────────────────────────────────────

async function importarLeads(
  deps: ImportDeps,
  workspaceId: string,
  dados: string[][],
  colunas: Partial<Record<CsvField, number>>,
): Promise<ImportReport> {
  const stageId = await deps.db.getNewStageId(workspaceId);
  if (!stageId) {
    return falhaGeral(dados.length, "workspace sem estágio inicial (NEW) no funil");
  }

  const relatorio: ImportReport = { total: dados.length, criados: 0, pulados: 0, erros: [] };
  const candidatos: Array<LinhaLida & { lead: NewLeadInput }> = [];

  for (const item of comoLinhas(dados)) {
    const resultado = lerLead(item, workspaceId, stageId, colunas);
    if ("erro" in resultado) relatorio.erros.push({ linha: item.linha, motivo: resultado.erro });
    else candidatos.push({ ...item, lead: resultado.lead });
  }

  const existentes = new Set(
    await deps.db.findExistingLeadPhones(
      workspaceId,
      candidatos.map((candidato) => candidato.lead.phone),
    ),
  );
  const vistosNoArquivo = new Set<string>();

  for (const candidato of candidatos) {
    const { phone } = candidato.lead;
    if (existentes.has(phone) || vistosNoArquivo.has(phone)) {
      relatorio.pulados += 1;
      continue;
    }
    vistosNoArquivo.add(phone);
    try {
      await deps.db.createLeadWithConversation(candidato.lead);
      relatorio.criados += 1;
    } catch (error) {
      relatorio.erros.push({
        linha: candidato.linha,
        motivo: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return relatorio;
}

function lerLead(
  item: LinhaLida,
  workspaceId: string,
  stageId: string,
  colunas: Partial<Record<CsvField, number>>,
): { lead: NewLeadInput } | { erro: string } {
  const name = celula(item.cells, colunas.name);
  if (!name) return { erro: "nome ausente" };

  const phoneBruto = celula(item.cells, colunas.phone);
  if (!phoneBruto) return { erro: "telefone ausente" };
  const phone = normalizePhone(phoneBruto);
  if (phone.replace(/\D/g, "").length < 10) return { erro: `telefone inválido: ${phoneBruto}` };

  const email = celula(item.cells, colunas.email);
  const empresa = celula(item.cells, colunas.company);
  const cargo = celula(item.cells, colunas.role);
  const tags: string[] = [];
  if (empresa) tags.push(`empresa: ${empresa}`);
  if (cargo) tags.push(`cargo: ${cargo}`);

  const valorBruto = celula(item.cells, colunas.value);
  return {
    lead: {
      workspaceId,
      stageId,
      name,
      phone,
      email: /^\S+@\S+\.\S+$/.test(email) ? email : null,
      source: celula(item.cells, colunas.source) || "import",
      valueCents: valorBruto ? parseValueCents(valorBruto) : null,
      tags,
    },
  };
}

// ── entity=prospects ────────────────────────────────────────────────────────

async function importarProspects(
  deps: ImportDeps,
  payload: ImportJobPayload,
  dados: string[][],
  colunas: Partial<Record<CsvField, number>>,
): Promise<ImportReport> {
  const listId = payload.prospectListId;
  if (!listId) {
    return falhaGeral(dados.length, "prospectListId ausente para importação de prospects");
  }
  if (!(await deps.db.prospectListBelongsToWorkspace(payload.workspaceId, listId))) {
    return falhaGeral(dados.length, "lista de prospects não encontrada no workspace");
  }

  const relatorio: ImportReport = { total: dados.length, criados: 0, pulados: 0, erros: [] };
  const existentes = new Set(await deps.db.findExistingProspectPhones(listId));
  const vistosNoArquivo = new Set<string>();

  for (const item of comoLinhas(dados)) {
    const name = celula(item.cells, colunas.name);
    if (!name) {
      relatorio.erros.push({ linha: item.linha, motivo: "nome ausente" });
      continue;
    }

    const phoneBruto = celula(item.cells, colunas.phone);
    const phone = phoneBruto ? normalizePhone(phoneBruto) : null;
    if (phone && (existentes.has(phone) || vistosNoArquivo.has(phone))) {
      relatorio.pulados += 1;
      continue;
    }
    if (phone) vistosNoArquivo.add(phone);

    const email = celula(item.cells, colunas.email);
    try {
      await deps.db.createProspect({
        listId,
        name,
        company: celula(item.cells, colunas.company) || null,
        role: celula(item.cells, colunas.role) || null,
        phone,
        email: email || null,
      });
      relatorio.criados += 1;
    } catch (error) {
      relatorio.erros.push({
        linha: item.linha,
        motivo: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return relatorio;
}

// ── Relatório final ─────────────────────────────────────────────────────────

async function finalizarImport(
  deps: ImportDeps,
  payload: ImportJobPayload,
  relatorio: ImportReport,
): Promise<void> {
  await deps.db.logEvent({
    workspaceId: payload.workspaceId,
    type: "import.finished",
    entity: "Import",
    entityId: payload.storageKey,
    data: {
      entity: payload.entity,
      total: relatorio.total,
      criados: relatorio.criados,
      pulados: relatorio.pulados,
      erros: relatorio.erros.slice(0, MAX_ERROS_NO_RELATORIO),
    },
  });
  await deps.publishNotify(payload.workspaceId, {
    kind: "import_finished",
    entity: payload.entity,
    storageKey: payload.storageKey,
    total: relatorio.total,
    criados: relatorio.criados,
    pulados: relatorio.pulados,
    erros: relatorio.erros.length,
  });
  deps.log.info(
    {
      workspaceId: payload.workspaceId,
      entity: payload.entity,
      total: relatorio.total,
      criados: relatorio.criados,
      pulados: relatorio.pulados,
      erros: relatorio.erros.length,
    },
    "importação de CSV concluída",
  );
}
