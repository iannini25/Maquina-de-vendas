/**
 * Wrapper da API do Explorium (Vibe Prospecting).
 * A busca envia a descrição do ICP e normaliza a resposta de forma defensiva:
 * se o formato divergir, devolve erro claro para o chat exibir — nunca inventa.
 */

const EXPLORIUM_SEARCH_URL = "https://api.explorium.ai/v1/prospects/search";
const MAX_RESULTS = 12;

export interface VibeProspect {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export type ExploriumSearchResult =
  | { ok: true; prospects: VibeProspect[] }
  | { ok: false; error: string };

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function toProspect(raw: unknown): VibeProspect | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const composedName = [pickString(row, ["first_name", "firstName"]), pickString(row, ["last_name", "lastName"])]
    .filter(Boolean)
    .join(" ");
  const name = pickString(row, ["full_name", "name", "prospect_name"]) ?? (composedName || null);
  if (!name) return null;

  return {
    name,
    company: pickString(row, ["company_name", "company", "organization", "current_company"]),
    role: pickString(row, ["job_title", "title", "role", "position", "job_seniority_role"]),
    email: pickString(row, ["email", "professional_email", "work_email", "personal_email"]),
    phone: pickString(row, ["phone", "phone_number", "mobile_phone", "professions_phone"]),
  };
}

/** Encontra o primeiro array de objetos plausível na resposta (formatos variam por versão). */
function findRowsArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["prospects", "data", "results", "records", "items"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null) {
      const nested = findRowsArray(value);
      if (nested) return nested;
    }
  }
  return null;
}

export async function searchExploriumProspects(
  apiKey: string,
  icpDescription: string,
): Promise<ExploriumSearchResult> {
  let response: Response;
  try {
    response = await fetch(EXPLORIUM_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: icpDescription, size: MAX_RESULTS }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return {
      ok: false,
      error: "Não consegui falar com o Vibe Prospecting (rede ou tempo esgotado). Tente de novo em instantes.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: "A chave do Vibe Prospecting foi recusada. Verifique a credencial do Explorium em Configurações.",
    };
  }
  if (response.status === 402 || response.status === 429) {
    return {
      ok: false,
      error: "O Vibe Prospecting recusou a busca por limite de créditos ou de requisições. Tente mais tarde.",
    };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const snippet = body.replace(/\s+/g, " ").slice(0, 160);
    return {
      ok: false,
      error: `O Explorium retornou HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "O Explorium respondeu em um formato que não consegui ler (não é JSON)." };
  }

  const rows = findRowsArray(payload);
  if (!rows) {
    return {
      ok: false,
      error: "O Explorium respondeu em um formato inesperado — nenhuma lista de prospects encontrada na resposta.",
    };
  }

  const prospects = rows
    .map(toProspect)
    .filter((prospect): prospect is VibeProspect => prospect !== null)
    .slice(0, MAX_RESULTS);

  return { ok: true, prospects };
}
