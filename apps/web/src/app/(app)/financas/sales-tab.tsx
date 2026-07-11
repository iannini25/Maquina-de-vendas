"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { CountUp, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { FinancePageData, OrderRow } from "@/server/finance/queries";

import { formatBRLShort, formatDayMonth } from "./brl";
import { CheckoutConnectPanel } from "./checkout-connect";

function originBadge(order: OrderRow): React.ReactNode {
  if (order.status === "REFUNDED") return <Badge tone="danger">Reembolsado</Badge>;
  if (order.status === "CHARGEBACK") return <Badge tone="danger">Chargeback</Badge>;
  if (order.source === "PIPELINE") return <Badge tone="success">Pipeline (Ganho)</Badge>;
  if (order.source === "WEBHOOK") {
    const provider = order.provider
      ? order.provider.charAt(0) + order.provider.slice(1).toLowerCase()
      : "Checkout";
    return <Badge tone="brand">Checkout · {provider}</Badge>;
  }
  // Lançamento manual pode registrar a origem real da venda (canal do modal).
  if (order.channel === "pipeline") return <Badge tone="success">Pipeline (Ganho)</Badge>;
  if (order.channel === "checkout") return <Badge tone="brand">Checkout</Badge>;
  return <Badge tone="muted">Manual</Badge>;
}

/** Aba Vendas: totais, conectar checkout, nota das 3 formas e tabela de pedidos. */
export function SalesTab({
  data,
  onNewSale,
}: {
  data: FinancePageData;
  onNewSale: () => void;
}) {
  const [connectOpen, setConnectOpen] = useState(false);
  const { sales } = data;
  const refundedTones = new Set(["REFUNDED", "CHARGEBACK"]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={onNewSale}>
          Lançar venda
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Total faturado
          </p>
          <p className="font-display tnum mt-1.5 text-[22px] font-semibold tracking-tight text-success">
            <CountUp value={sales.totalCents} format={formatBRLShort} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Ticket médio
          </p>
          <p className="font-display tnum mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
            {sales.avgTicketCents === null ? "—" : formatBRLShort(sales.avgTicketCents)}
          </p>
        </Card>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="rounded-2xl border border-dashed border-brand-3/40 bg-brand-soft/40 p-4 text-left transition-all duration-200 ease-[var(--ease-out)] hover:border-brand-3/70 hover:bg-brand-soft"
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-accent">
            Conectar checkout
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Hotmart · Kiwify · Eduzz · Stripe — vendas entram sozinhas.
          </p>
        </button>
      </div>

      <div className="rounded-2xl border border-hairline bg-white/[0.02] px-4 py-3 text-[12.5px] text-ink-3">
        3 formas de registrar vendas: <strong className="font-semibold text-ink-2">manual</strong> ·{" "}
        <strong className="font-semibold text-ink-2">automática</strong> (todo &quot;Ganho&quot; no
        Pipeline vira venda) · <strong className="font-semibold text-ink-2">integração</strong>{" "}
        (checkout).
      </div>

      {sales.orders.length === 0 ? (
        <EmptyState
          title="Nenhuma venda registrada"
          hint="Lance uma venda manual, ganhe um lead no Pipeline ou conecte seu checkout."
          action={
            <Button variant="primary" size="sm" onClick={onNewSale}>
              Lançar venda
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Data</TH>
            <TH>Produto</TH>
            <TH>Valor</TH>
            <TH>Qtd</TH>
            <TH>Origem</TH>
          </THead>
          <TBody>
            {sales.orders.map((order) => {
              const refunded = refundedTones.has(order.status);
              return (
                <TR key={order.id}>
                  <TD className="tnum">{formatDayMonth(order.dateIso)}</TD>
                  <TD className="font-medium text-ink">{order.productName}</TD>
                  <TD
                    className={cn(
                      "tnum font-semibold",
                      refunded ? "text-ink-3 line-through" : "text-success",
                    )}
                  >
                    {formatBRLShort(order.valueCents)}
                  </TD>
                  <TD className="tnum">{order.qty}</TD>
                  <TD>{originBadge(order)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <CheckoutConnectPanel
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        providers={data.checkout}
        products={data.products}
      />
    </div>
  );
}
