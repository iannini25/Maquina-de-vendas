"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { importCsvProspectsAction, type CsvImportError } from "@/server/prospecting/actions";

/**
 * "Importar base": parse do CSV no cliente + mapeamento de colunas
 * (Nome/Empresa/Cargo/WhatsApp/E-mail) → cria lista IMPORT com relatório.
 */

const MAPPING_TARGETS = [
  { key: "name", label: "Nome", required: true },
  { key: "company", label: "Empresa", required: false },
  { key: "role", label: "Cargo", required: false },
  { key: "phone", label: "WhatsApp", required: false },
  { key: "email", label: "E-mail", required: false },
] as const;

type MappingKey = (typeof MAPPING_TARGETS)[number]["key"];

/** Parser CSV manual simples: aspas, "" escapado e delimitador , ou ;. */
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** Chuta o mapeamento inicial pelo texto do cabeçalho. */
function guessMapping(header: string[]): Record<MappingKey, number> {
  const guess: Record<MappingKey, number> = { name: -1, company: -1, role: -1, phone: -1, email: -1 };
  header.forEach((cell, index) => {
    const value = cell.trim().toLowerCase();
    if (guess.name === -1 && /nome|name/.test(value)) guess.name = index;
    else if (guess.company === -1 && /empresa|company|organiza/.test(value)) guess.company = index;
    else if (guess.role === -1 && /cargo|role|título|title|função/.test(value)) guess.role = index;
    else if (guess.phone === -1 && /whats|fone|phone|celular|telefone/.test(value)) guess.phone = index;
    else if (guess.email === -1 && /mail/.test(value)) guess.email = index;
  });
  if (guess.name === -1) guess.name = 0;
  return guess;
}

interface ImportReport {
  listName: string;
  created: number;
  errors: CsvImportError[];
}

export function CsvImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<MappingKey, number>>({
    name: 0,
    company: -1,
    role: -1,
    phone: -1,
    email: -1,
  });
  const [listName, setListName] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const header = rows[0] ?? [];
  const columnCount = header.length;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  function resetAll() {
    setFileName(null);
    setRows([]);
    setHasHeader(true);
    setListName("");
    setReport(null);
    setParseError(null);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  async function handleFile(file: File) {
    setParseError(null);
    setReport(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setParseError("O arquivo está vazio ou não parece um CSV válido.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    setMapping(guessMapping(parsed[0] ?? []));
    setListName(file.name.replace(/\.[^.]+$/, ""));
  }

  async function handleImport() {
    if (mapping.name < 0) {
      toast("Mapeie a coluna Nome antes de importar.", "danger");
      return;
    }
    const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
    const payloadRows = dataRows.map((row, index) => ({
      linha: index + (hasHeader ? 2 : 1),
      name: cell(row, mapping.name),
      company: cell(row, mapping.company) || undefined,
      role: cell(row, mapping.role) || undefined,
      phone: cell(row, mapping.phone) || undefined,
      email: cell(row, mapping.email) || undefined,
    }));

    setImporting(true);
    const result = await importCsvProspectsAction({ listName: listName.trim(), rows: payloadRows });
    setImporting(false);

    if (!result.ok) {
      toast(result.error ?? "Não foi possível importar.", "danger");
      if (result.errors?.length) {
        setReport({ listName: listName.trim(), created: 0, errors: result.errors });
      }
      return;
    }
    setReport({
      listName: result.listName ?? listName.trim(),
      created: result.created ?? 0,
      errors: result.errors ?? [],
    });
    toast(`Lista "${result.listName}" criada com ${result.created} prospects.`, "success");
    onImported();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar base"
      subtitle="Suba um CSV e mapeie as colunas."
      width="max-w-2xl"
      footer={
        report ? (
          <Button variant="primary" onClick={handleClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={importing}
              disabled={rows.length === 0 || !listName.trim() || dataRows.length === 0}
              onClick={handleImport}
            >
              Importar {dataRows.length > 0 ? `${dataRows.length} linhas` : ""}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />

        {report ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-success/30 bg-success/[0.08] px-4 py-3 text-[13px] text-success">
              {report.created} prospects importados para a lista &quot;{report.listName}&quot;.
            </div>
            {report.errors.length > 0 && (
              <div className="rounded-2xl border border-warm/25 bg-warm/[0.08] px-4 py-3">
                <p className="mb-2 text-[12.5px] font-semibold text-warm">
                  {report.errors.length} linhas ignoradas:
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-[12px] text-ink-2">
                  {report.errors.map((error) => (
                    <li key={`${error.linha}-${error.motivo}`}>
                      Linha {error.linha}: {error.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-ink-3 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink-2"
            >
              {fileName ? (
                <>
                  <span className="font-semibold text-ink">{fileName}</span> · {rows.length} linhas
                  lidas — clique para trocar o arquivo
                </>
              ) : (
                <>⬆ Clique para escolher o arquivo .csv (colunas: nome, empresa, cargo, WhatsApp, e-mail)</>
              )}
            </button>
            {parseError && <p className="text-xs text-danger">{parseError}</p>}

            {rows.length > 0 && (
              <>
                <Toggle
                  checked={hasHeader}
                  onChange={setHasHeader}
                  label="Primeira linha é cabeçalho"
                  hint="Desligue se o arquivo já começa nos dados."
                />
                <Input
                  label="Nome da lista"
                  requiredMark
                  placeholder="Ex.: Base evento SP"
                  value={listName}
                  onChange={(event) => setListName(event.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MAPPING_TARGETS.map((target) => (
                    <Select
                      key={target.key}
                      label={target.label}
                      requiredMark={target.required}
                      value={String(mapping[target.key])}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [target.key]: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={-1}>— não importar —</option>
                      {Array.from({ length: columnCount }).map((_, index) => (
                        <option key={index} value={index}>
                          Coluna {index + 1}
                          {hasHeader && header[index]?.trim() ? ` — ${header[index].trim()}` : ""}
                        </option>
                      ))}
                    </Select>
                  ))}
                </div>
                {dataRows[0] && (
                  <p className="rounded-[11px] border border-hairline bg-surface-2 px-3 py-2 text-[11.5px] text-ink-3">
                    Prévia da 1ª linha:{" "}
                    <span className="text-ink-2">
                      {MAPPING_TARGETS.map(
                        (target) =>
                          `${target.label}: ${
                            mapping[target.key] >= 0
                              ? dataRows[0]?.[mapping[target.key]]?.trim() || "—"
                              : "—"
                          }`,
                      ).join(" · ")}
                    </span>
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
