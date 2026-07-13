import { createHash, createHmac } from "node:crypto";

/**
 * Cliente S3/MinIO mínimo com assinatura AWS SigV4 via fetch — sem SDK pesado.
 * Operações: putObject, getObject, deleteObject, presignGet.
 */

interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

function loadConfig(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
    bucket: process.env.S3_BUCKET ?? "sales4u",
    region: process.env.S3_REGION ?? "us-east-1",
  };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function signRequest(
  config: S3Config,
  method: string,
  key: string,
  body: Buffer | null,
  contentType?: string,
): SignedRequest {
  const url = new URL(`${config.endpoint}/${config.bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? sha256Hex(body) : sha256Hex("");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (contentType) headers["content-type"] = contentType;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(config.secretKey, dateStamp, config.region),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

/** Cria o bucket se não existir (MinIO não cria sozinho) — auto-provisionamento. */
async function ensureBucket(config: S3Config): Promise<void> {
  const url = new URL(`${config.endpoint}/${config.bucket}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");
  const canonicalRequest = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region))
    .update(stringToSign, "utf8")
    .digest("hex");
  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  // 200 = criado; 409 (BucketAlreadyOwnedByYou) = já existe — ambos ok.
  if (!response.ok && response.status !== 409) {
    throw new Error(`S3 ensureBucket falhou: ${response.status} ${await response.text()}`);
  }
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string }> {
  const config = loadConfig();
  const attempt = async (): Promise<Response> => {
    const { url, headers } = signRequest(config, "PUT", key, body, contentType);
    return fetch(url, {
      method: "PUT",
      headers,
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(30_000),
    });
  };

  let response = await attempt();
  if (response.status === 404) {
    const text = await response.text();
    if (text.includes("NoSuchBucket")) {
      await ensureBucket(config);
      response = await attempt();
    } else if (!response.ok) {
      throw new Error(`S3 putObject falhou: 404 ${text}`);
    }
  }
  if (!response.ok) {
    throw new Error(`S3 putObject falhou: ${response.status} ${await response.text()}`);
  }
  return { key };
}

export async function getObject(key: string): Promise<Buffer> {
  const config = loadConfig();
  const { url, headers } = signRequest(config, "GET", key, null);
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`S3 getObject falhou: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteObject(key: string): Promise<void> {
  const config = loadConfig();
  const { url, headers } = signRequest(config, "DELETE", key, null);
  const response = await fetch(url, {
    method: "DELETE",
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`S3 deleteObject falhou: ${response.status}`);
  }
}

/** Testa leitura+escrita no bucket (verificador do Setup Gate). */
export async function checkBucketReadWrite(): Promise<{ ok: boolean; error?: string }> {
  try {
    const probe = `healthcheck/probe-${Date.now()}.txt`;
    await putObject(probe, Buffer.from("ok"), "text/plain");
    const read = await getObject(probe);
    await deleteObject(probe);
    return { ok: read.toString() === "ok" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
