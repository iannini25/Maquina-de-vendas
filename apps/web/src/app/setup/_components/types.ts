/**
 * DTOs serializáveis do Setup Gate / Configurações (espelham
 * @/server/credentials sem importar código de servidor no client).
 */

export interface CredentialFieldDTO {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  optional?: boolean;
}

export type CredentialStatusDTO = "PENDING" | "OK" | "ERROR" | "MISSING";

export interface CredentialViewDTO {
  provider: string;
  title: string;
  description: string;
  required: boolean;
  note?: string;
  status: CredentialStatusDTO;
  lastCheckAt: string | null;
  lastError: string | null;
  /** Segredos já chegam mascarados (••••) do servidor. */
  values: Record<string, string>;
  fields: CredentialFieldDTO[];
  docsUrl?: string;
}

export interface CoreDetailsDTO {
  ok: boolean;
  details: {
    encryptionKey: boolean;
    database: boolean;
    redis: boolean;
    authSecret: boolean;
  };
}

/** Converte o retorno de coreEnvironmentOk() (Record aberto) no DTO tipado. */
export function toCoreDetailsDTO(core: {
  ok: boolean;
  details: Record<string, boolean>;
}): CoreDetailsDTO {
  return {
    ok: core.ok,
    details: {
      encryptionKey: Boolean(core.details.encryptionKey),
      database: Boolean(core.details.database),
      redis: Boolean(core.details.redis),
      authSecret: Boolean(core.details.authSecret),
    },
  };
}

export interface DomainSettingsDTO {
  appDomain: string;
  landingDomain: string;
  status: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  dev: boolean;
}

export const CHECKOUT_PROVIDERS = ["HOTMART", "KIWIFY", "EDUZZ", "STRIPE"] as const;
export const TRACKING_PROVIDERS = ["META_PIXEL", "GOOGLE_TAG"] as const;

export function findView(views: CredentialViewDTO[], provider: string): CredentialViewDTO {
  const view = views.find((v) => v.provider === provider);
  if (!view) {
    throw new Error(`Credencial ${provider} ausente na lista do servidor`);
  }
  return view;
}
