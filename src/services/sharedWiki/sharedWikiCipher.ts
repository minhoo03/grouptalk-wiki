import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
/** GCM 권장 nonce 길이 */
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type EncryptedPayload = {
  /** base64(암호문 || 인증 태그) */
  ciphertext: string;
  /** base64(iv) */
  iv: string;
};

function readKey() {
  const encoded = process.env.CHAT_ENCRYPTION_KEY;
  const key = encoded ? Buffer.from(encoded, "base64") : null;

  if (!key || key.length !== KEY_BYTES) {
    throw new Error(
      "CHAT_ENCRYPTION_KEY 환경변수가 없거나 32바이트 base64 값이 아닙니다.",
    );
  }
  return key;
}

/**
 * AES-256-GCM으로 암호화한다.
 * 공유 코드를 AAD로 묶어, DB에서 다른 행의 암호문으로 바꿔치기하면 복호화가 실패하게 한다.
 */
export function encryptText(plainText: string, code: string): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, readKey(), iv);
  cipher.setAAD(Buffer.from(code, "utf8"));

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/** 키가 바뀌었거나 데이터가 변조됐으면 throw한다. */
export function decryptText(payload: EncryptedPayload, code: string): string {
  const data = Buffer.from(payload.ciphertext, "base64");
  const iv = Buffer.from(payload.iv, "base64");

  if (iv.length !== IV_BYTES || data.length < AUTH_TAG_BYTES) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }

  const decipher = createDecipheriv(ALGORITHM, readKey(), iv);
  decipher.setAAD(Buffer.from(code, "utf8"));
  decipher.setAuthTag(data.subarray(data.length - AUTH_TAG_BYTES));

  return Buffer.concat([
    decipher.update(data.subarray(0, data.length - AUTH_TAG_BYTES)),
    decipher.final(),
  ]).toString("utf8");
}
