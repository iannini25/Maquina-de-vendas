"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { importLeadsCsv } from "@/server/pipeline/actions";
import type { CsvImportError } from "@/server/pipeline/types";

/** Parser CSV simples com suporte a aspas (sem dependência externa). */
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

type FieldKey = "nome" | "whatsapp" | "email" | "origem" | "valor";

const FIELD_DEFS: Array<{ key: FieldKey; label: string; required: boolean; guess: RegExp }> = [
  { key: "nome", label: "Nome", required: true, guess: /nome|name/i },
  { key: "whatsapp", label: "WhatsApp", required: true, guess: /whats|phone|fone|tel|celular/i },
  { key: "email", label: "E-mail", required: false, guess: /mail/i },
  { key: "origem", label: "Origem", required: false, guess: /origem|source|canal/i },
  { key: "valor", label: "Valor", required: false, guess: /valor|value|pre[çc]o|price/i },
];

type Step = "upload" | "map" | "result";

/** Modal de importação em massa de leads via CSV (prévia + mapeamento + relatório). */
export function ImportCsvModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({
    nome: -1,
    whatsapp: -1,
    email: -1,
    origem: -1,
    valor: -1,
  });
  const [startCadence, setStartCadence] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ criados: number; erros: CsvImportError[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setDataRows([]);
    setMapping({ nome: -1, whatsapp: -1, email: -1, origem: -1, valor: -1 });
    setStartCadence(true);
    setError(null);
    setImporting(false);
    setResult(null);
  }, [open]);

  async function handleFile(file: File) {
    setError(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Envie um arquivo .csv (valores separados por vírgula ou ponto-e-vírgula).");
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setError("O arquivo precisa de um cabeçalho e pelo menos uma linha de dados.");
      return;
    }
    const headerRow = rows[0]!.map((h) => h.trim());
    const nextMapping: Record<FieldKey, number> = {
      nome: -1,
      whatsapp: -1,
      email: -1,
      origem: -1,
      valor: -1,
    };
    for (const def of FIELD_DEFS) {
      const index = headerRow.findIndex((h) => def.guess.test(h));
      if (index >= 0) nextMapping[def.key] = index;
    }
    setFileName(file.name);
    setHeaders(headerRow);
    setDataRows(rows.slice(1));
    setMapping(nextMapping);
    setStep("map");
  }

  async function handleImport() {
    if (mapping.nome < 0 || mapping.whatsapp < 0) {
      setError("Mapeie pelo menos as colunas Nome e WhatsApp.");
      return;
    }
    setError(null);
    setImporting(true);

    const rows = dataRows.map((cells, index) => ({
      linha: index + 2, // 1-indexado + cabeçalho
      nome: cells[mapping.nome]?.trim() ?? "",
      whatsapp: cells[mapping.whatsapp]?.trim() ?? "",
      email: mapping.email >= 0 ? (cells[mapping.email]?.trim() ?? "") : undefined,
      origem: mapping.origem >= 0 ? (cells[mapping.origem]?.trim() ?? "") : undefined,
      valor: mapping.valor >= 0 ? (cells[mapping.valor]?.trim() ?? "") : undefined,
    }));

    const response = await importLeadsCsv({ rows, startCadence });
    setImporting(false);

    if (response.ok) {
      setResult({ criados: response.criados ?? 0, erros: response.erros ?? [] });
      setStep("result");
      onImported();
    } else {
      setError(response.error ?? "Falha na importação.");
    }
  }

  const previewRows = dataRows.slice(0, 5);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar leads em massa"
      subtitle="Envie um .csv, confira a prévia e mapeie as colunas."
      width="max-w-2xl"
      footer={
        step === "map" ? (
          <>
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Voltar
            </Button>
            <Button variant="primary" loading={importing} onClick={() => void handleImport()}>
              Importar {dataRows.length} linha{dataRows.length === 1 ? "" : "s"}
            </Button>
          </>
        ) : step === "result" ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        )
      }
    >
      {error && <ErrorState message={error} className="mb-4" />}

      {step === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-12 text-center transition-colors duration-[130ms] hover:border-brand-3/40"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-7 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span className="text-sm font-semibold text-ink">
              Arraste o .csv aqui ou clique para escolher
            </span>
            <span className="text-[12px] text-ink-3">
              Colunas esperadas: Nome, WhatsApp e, se tiver, E-mail, Origem e Valor.
            </span>
          </button>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-5">
          <p className="text-[12.5px] text-ink-3">
            <span className="font-medium text-ink-2">{fileName}</span> · {dataRows.length} linha
            {dataRows.length === 1 ? "" : "s"} de dados
          </p>

          {/* Prévia das 5 primeiras linhas */}
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline-soft">
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3"
                    >
                      {header || `Coluna ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                {previewRows.map((cells, r) => (
                  <tr key={r}>
                    {headers.map((_, c) => (
                      <td key={c} className="max-w-40 truncate px-3 py-2 text-[12px] text-ink-2">
                        {cells[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapeamento de colunas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_DEFS.map((def) => (
              <Select
                key={def.key}
                label={def.label}
                requiredMark={def.required}
                value={String(mapping[def.key])}
                onChange={(e) =>
                  setMapping((prev) => ({ ...prev, [def.key]: Number(e.target.value) }))
                }
              >
                <option value={-1}>— Ignorar —</option>
                {headers.map((header, i) => (
                  <option key={i} value={i}>
                    {header || `Coluna ${i + 1}`}
                  </option>
                ))}
              </Select>
            ))}
          </div>

          <Toggle
            checked={startCadence}
            onChange={setStartCadence}
            label="Iniciar cadência de boas-vindas"
            hint="A IA envia a primeira mensagem para cada lead importado, seguindo o playbook do estágio inicial."
          />
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-success/30 bg-success/10 px-4 py-3.5">
            <span className="tnum text-2xl font-bold text-success">{result.criados}</span>
            <div>
              <p className="text-sm font-semibold text-ink">
                lead{result.criados === 1 ? "" : "s"} importado{result.criados === 1 ? "" : "s"}
              </p>
              <p className="text-[12px] text-ink-3">
                {startCadence
                  ? "Cadência de boas-vindas agendada para cada um."
                  : "Sem cadência — os leads aguardam sua primeira ação."}
              </p>
            </div>
          </div>

          {result.erros.length > 0 ? (
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-ink-2">
                {result.erros.length} linha{result.erros.length === 1 ? "" : "s"} com erro
                (não importada{result.erros.length === 1 ? "" : "s"}):
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-danger/25 bg-danger/5 p-3">
                {result.erros.map((erro, i) => (
                  <li key={i} className="text-[12px] text-danger">
                    Linha {erro.linha}: {erro.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-3">Nenhum erro — todas as linhas entraram.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
