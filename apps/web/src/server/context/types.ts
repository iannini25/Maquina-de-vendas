/**
 * Tipos e constantes do módulo Contexto (Arquivos de Contexto / RAG).
 * Client components importam apenas tipos e constantes daqui.
 */

export type ContextTypeDto =
  | "DESIGN_SYSTEM"
  | "TEXT"
  | "PDF"
  | "FAQ"
  | "PRICING"
  | "OBJECTIONS"
  | "TONE"
  | "ICP"
  | "SCRIPTS";

export type ContextStatusDto = "PENDING" | "PROCESSING" | "INDEXED" | "ERROR";

/** Labels do select "Tipo" do modal (ordem do protótipo). */
export const CONTEXT_TYPE_OPTIONS: Array<{ value: ContextTypeDto; label: string }> = [
  { value: "DESIGN_SYSTEM", label: "Design System (.md)" },
  { value: "TEXT", label: "Texto livre" },
  { value: "PDF", label: "PDF" },
  { value: "FAQ", label: "FAQ" },
  { value: "PRICING", label: "Tabela de preços" },
  { value: "OBJECTIONS", label: "Objeções" },
  { value: "TONE", label: "Tom de voz" },
  { value: "ICP", label: "ICP" },
  { value: "SCRIPTS", label: "Scripts" },
];

/** Label curto da coluna TIPO da tabela. */
export const CONTEXT_TYPE_SHORT: Record<ContextTypeDto, string> = {
  DESIGN_SYSTEM: "Design System",
  TEXT: "Texto",
  PDF: "PDF",
  FAQ: "FAQ",
  PRICING: "Preços",
  OBJECTIONS: "Objeções",
  TONE: "Tom",
  ICP: "ICP",
  SCRIPTS: "Scripts",
};

/** Cards de categoria da tela (clique pré-preenche o tipo no modal). */
export const CONTEXT_CATEGORY_CARDS: Array<{ label: string; type: ContextTypeDto }> = [
  { label: "Persona (tom de voz)", type: "TONE" },
  { label: "Oferta e preço", type: "PRICING" },
  { label: "Objeções comuns", type: "OBJECTIONS" },
  { label: "FAQ", type: "FAQ" },
  { label: "Cliente ideal (ICP)", type: "ICP" },
  { label: "Regras comerciais", type: "SCRIPTS" },
];

/** Template de exemplo do Design System (bloco de código do protótipo). */
export const DESIGN_SYSTEM_TEMPLATE = `# Design System — {Projeto}
## Marca (obrigatório)
- Nome, logo (URL), slogan
## Cores (obrigatório)
- Primária: #...  | Fundo: #...  | Texto: #...
- Sucesso / Aviso / Erro
## Tipografia (obrigatório)
- Títulos: {fonte} | Corpo: {fonte}
## Tom de voz (obrigatório)
- Como a marca escreve (ex.: direto, caloroso, sem jargão)
## Componentes / E-mail (obrigatório)
- Estilo de botão, raio, espaçamento, largura, header/footer
## Do / Don't (obrigatório)
- O que sempre fazer / o que evitar
`;

export interface ContextFileDto {
  id: string;
  name: string;
  type: ContextTypeDto;
  status: ContextStatusDto;
  /** Nome do produto ou campanha vinculada (ou null). */
  linkLabel: string | null;
  /** Valor do vínculo no formato "product:<id>" | "campaign:<id>" | "". */
  linkValue: string;
  rawText: string | null;
  hasStorage: boolean;
  error: string | null;
  updatedAtIso: string;
}

export interface LinkOptionDto {
  value: string;
  label: string;
}

export interface DesignSystemDto {
  id: string;
  name: string;
  status: ContextStatusDto;
  rawText: string | null;
}

export interface ContextPageData {
  files: ContextFileDto[];
  designSystem: DesignSystemDto | null;
  linkOptions: LinkOptionDto[];
}

export interface ContextActionResult {
  ok: boolean;
  error?: string;
}
