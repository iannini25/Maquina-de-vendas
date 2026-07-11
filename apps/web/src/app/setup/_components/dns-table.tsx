"use client";

import { useToast } from "@/components/ui/toast";

export interface DnsRow {
  type: string;
  host: string;
  value: string;
}

/** Tabela DNS do protótipo: TIPO / HOST / VALOR + "Copiar" por linha. */
export function DnsTable({ rows }: { rows: DnsRow[] }) {
  const { toast } = useToast();

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Valor copiado.");
    } catch {
      toast("Não foi possível copiar — copie manualmente.", "danger");
    }
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-hairline bg-white/[0.02]">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline-soft">
            {["Tipo", "Host", "Valor", ""].map((label, index) => (
              <th
                key={index}
                className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-4 py-2.5 font-mono text-[12px] text-accent">{row.type}</td>
              <td className="max-w-44 truncate px-4 py-2.5 font-mono text-[12px] text-ink">
                {row.host}
              </td>
              <td className="max-w-72 truncate px-4 py-2.5 font-mono text-[12px] text-ink-2">
                {row.value}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => copy(row.value)}
                  className="rounded-full px-2 py-0.5 text-[11.5px] font-medium text-ink-3 transition-colors duration-[130ms] hover:bg-surface-3 hover:text-ink"
                >
                  Copiar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
