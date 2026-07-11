import { createHash, createHmac } from "node:crypto";

/**
 * Mini cliente S3/MinIO: GET de objeto com assinatura AWS Signature V4.
 * Sem SDK — só node:crypto + fetch. Config por parâmetro (testável) com
 * leitura das envs S3_* em s3ConfigFromEnv().
 */

export interface S3Config {
  /** Ex.: http://localhost:9000 (MinIO) — sem barra final. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

/** Contrato mínimo de resposta HTTP binária (satisfeito pelo fetch do Node). */
export interface BinaryResponseLike {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type BinaryFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<BinaryResponseLike>;

/** Erro tipado do storage — status HTTP preservado para o chamador decidir. */
export class StorageError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

const SIGNED_HEADERS = "host;x-amz-content-sha256;x-amz-date";
/** SHA-256 de payload vazio (GET não tem corpo). */
const EMPTY_PAYLOAD_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Lê a configuração S3 das envs; lança erro claro listando as ausentes. */
export function s3ConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): S3Config {
  const wanted = {
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY: env.S3_ACCESS_KEY,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
  };
  const missing = Object.entries(wanted)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Configuração S3 incompleta — faltam: ${missing.join(", ")}`);
  }
  return {
    endpoint: wanted.S3_ENDPOINT as string,
    region: wanted.S3_REGION as string,
    bucket: wanted.S3_BUCKET as string,
    accessKey: wanted.S3_ACCESS_KEY as string,
    secretKey: wanted.S3_SECRET_KEY as string,
  };
}

/** Baixa um objeto do bucket configurado; lança StorageError em resposta não-2xx. */
export async function getObject(
  config: S3Config,
  key: string,
  fetchFn: BinaryFetchLike = defaultBinaryFetch(),
  now: Date = new Date(),
): Promise<Uint8Array> {
  const { url, headers } = signGetRequest(config, key, now);
  const response = await fetchFn(url, { method: "GET", headers });
  if (!response.ok) {
    throw new StorageError(response.status, `S3 respondeu ${response.status} para "${key}"`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Monta URL + headers assinados (AWS4-HMAC-SHA256) de um GET path-style. */
export function signGetRequest(
  config: S3Config,
  key: string,
  now: Date,
): { url: string; headers: Record<string, string> } {
  const canonicalPath = `/${config.bucket}/${encodeS3Key(key)}`;
  const url = `${config.endpoint.replace(/\/+$/, "")}${canonicalPath}`;
  const host = new URL(url).host;
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${EMPTY_PAYLOAD_SHA256}\n` +
    `x-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    "GET",
    canonicalPath,
    "",
    canonicalHeaders,
    SIGNED_HEADERS,
    EMPTY_PAYLOAD_SHA256,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region))
    .update(stringToSign)
    .digest("hex");

  return {
    url,
    headers: {
      "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256,
      "x-amz-date": amzDate,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, ` +
        `SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    },
  };
}

/** Encoda cada segmento da chave (RFC 3986) preservando as barras. */
function encodeS3Key(key: string): string {
  return key.split("/").map(encodeRfc3986).join("/");
}

function encodeRfc3986(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** ISO-8601 básico exigido pela assinatura: YYYYMMDD'T'HHMMSS'Z'. */
function toAmzDate(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Cadeia de HMACs que deriva a chave de assinatura do dia/região/serviço. */
function signingKey(secretKey: string, dateStamp: string, region: string): Buffer {
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

/** fetch global do Node ≥ 18, atrás do contrato binário mínimo. */
function defaultBinaryFetch(): BinaryFetchLike {
  const holder = globalThis as { fetch?: BinaryFetchLike };
  const globalFetch = holder.fetch;
  if (!globalFetch) {
    return () =>
      Promise.reject(new Error("fetch global indisponível — injete um BinaryFetchLike"));
  }
  return (url, init) => globalFetch(url, init);
}
