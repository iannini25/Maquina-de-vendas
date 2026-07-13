import { describe, expect, it } from "vitest";

import {
  getObject,
  s3ConfigFromEnv,
  signGetRequest,
  StorageError,
  type BinaryFetchLike,
  type S3Config,
} from "./storage.js";

const config: S3Config = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  bucket: "sales4u",
  accessKey: "minio",
  secretKey: "minio123",
};

const fixedNow = new Date("2026-07-11T03:15:00.000Z");

describe("signGetRequest", () => {
  it("monta URL path-style e headers SigV4 com escopo do dia/região", () => {
    const { url, headers } = signGetRequest(config, "context/guia.pdf", fixedNow);

    expect(url).toBe("http://localhost:9000/sales4u/context/guia.pdf");
    expect(headers["x-amz-date"]).toBe("20260711T031500Z");
    expect(headers["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=minio\/20260711\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });

  it("é determinística para as mesmas entradas", () => {
    const first = signGetRequest(config, "a/b.txt", fixedNow);
    const second = signGetRequest(config, "a/b.txt", fixedNow);

    expect(first).toEqual(second);
  });

  it("encoda cada segmento da chave (RFC 3986) preservando as barras", () => {
    const { url } = signGetRequest(config, "pasta com espaço/arquivo (1).pdf", fixedNow);

    expect(url).toBe(
      "http://localhost:9000/sales4u/pasta%20com%20espa%C3%A7o/arquivo%20%281%29.pdf",
    );
  });
});

describe("getObject", () => {
  it("baixa o objeto e devolve os bytes", async () => {
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchFn: BinaryFetchLike = async (url, init) => {
      requests.push({ url, headers: init.headers });
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
    };

    const result = await getObject(config, "context/x.bin", fetchFn, fixedNow);

    expect([...result]).toEqual([1, 2, 3]);
    expect(requests[0]?.url).toBe("http://localhost:9000/sales4u/context/x.bin");
    expect(requests[0]?.headers.authorization).toContain("AWS4-HMAC-SHA256");
  });

  it("lança StorageError com o status em resposta não-2xx", async () => {
    const fetchFn: BinaryFetchLike = async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const failure = getObject(config, "nao-existe.txt", fetchFn, fixedNow);

    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });
});

describe("s3ConfigFromEnv", () => {
  it("lê as envs S3_* completas", () => {
    expect(
      s3ConfigFromEnv({
        S3_ENDPOINT: "http://localhost:9000",
        S3_REGION: "us-east-1",
        S3_BUCKET: "sales4u",
        S3_ACCESS_KEY: "minio",
        S3_SECRET_KEY: "minio123",
      }),
    ).toEqual(config);
  });

  it("lista TODAS as envs ausentes no erro", () => {
    expect(() => s3ConfigFromEnv({ S3_ENDPOINT: "x" })).toThrowError(
      /S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY/,
    );
  });
});
