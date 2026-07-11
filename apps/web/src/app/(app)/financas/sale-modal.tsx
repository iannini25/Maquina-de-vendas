"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createManualOrder } from "@/server/finance/actions";
import type { ProductOption } from "@/server/finance/queries";

import { formatBRLShort } from "./brl";

function todayInput(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Modal "Lançar venda" (Produto* · Valor* · Qtd · Data* · Canal/origem). */
export function SaleModal({
  open,
  onClose,
  products,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
}) {
  const { toast } = useToast();
  const [productOfferId, setProductOfferId] = useState(products[0]?.id ?? "");
  const [valueRaw, setValueRaw] = useState("");
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayInput());
  const [channel, setChannel] = useState<"pipeline" | "checkout" | "manual">("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reabre limpo e sugere o preço do produto no campo Valor.
  useEffect(() => {
    if (!open) return;
    setProductOfferId(products[0]?.id ?? "");
    setValueRaw(products[0] ? formatBRLShort(products[0].priceCents) : "");
    setQty("1");
    setDate(todayInput());
    setChannel("manual");
    setError(null);
  }, [open, products]);

  const onProductChange = (id: string) => {
    setProductOfferId(id);
    const product = products.find((p) => p.id === id);
    if (product) setValueRaw(formatBRLShort(product.priceCents));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await createManualOrder({
      productOfferId,
      valueRaw,
      qty: Math.max(1, Number.parseInt(qty, 10) || 1),
      date,
      channel,
    });
    setSaving(false);
    if (result.ok) {
      toast("Venda lançada.", "success");
      onClose();
    } else {
      setError(result.error ?? "Não foi possível lançar a venda.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançar venda"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Lançar
          </Button>
        </>
      }
    >
      {products.length === 0 ? (
        <ErrorState message="Cadastre um produto no Setup antes de lançar vendas." />
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Produto"
            requiredMark
            value={productOfferId}
            onChange={(event) => onProductChange(event.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatBRLShort(product.priceCents)}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Valor"
              requiredMark
              placeholder="R$ 1.997"
              value={valueRaw}
              onChange={(event) => setValueRaw(event.target.value)}
            />
            <Input
              label="Qtd"
              type="number"
              min={1}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
            />
            <Input
              label="Data"
              requiredMark
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <Select
            label="Canal / origem"
            value={channel}
            onChange={(event) => setChannel(event.target.value as typeof channel)}
          >
            <option value="manual">Manual</option>
            <option value="pipeline">Pipeline (Ganho)</option>
            <option value="checkout">Checkout</option>
          </Select>

          {error && <ErrorState message={error} />}
        </div>
      )}
    </Modal>
  );
}
