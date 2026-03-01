import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import crypto from "crypto";
import path from "path";

const isProduction = !!process.env.R2_ACCOUNT_ID;

// ── R2 Client ───────────────────────────────────────────
const r2 = isProduction
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const BUCKET = process.env.R2_BUCKET || "pixsign-docs";

// ── Upload ──────────────────────────────────────────────
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  folder: "originals" | "signed" = "originals"
): Promise<string> {
  const ext = path.extname(originalName) || ".pdf";
  const key = `${folder}/${randomUUID()}${ext}`;

  if (r2) {
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );
    return key;
  } else {
    // Dev: fall back to local filesystem
    const fs = await import("fs/promises");
    const fsSync = await import("fs");
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    fsSync.mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/${folder}/${filename}`;
  }
}

// ── Download ────────────────────────────────────────────
export async function downloadFile(key: string): Promise<Buffer> {
  if (r2 && !key.startsWith("/")) {
    const response = await r2.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    // Use AWS SDK's built-in stream conversion (works in both Node.js and Edge)
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  } else {
    // Dev: read from local filesystem
    const fs = await import("fs/promises");
    const filePath = key.startsWith("/")
      ? path.join(process.cwd(), "public", key)
      : path.join(process.cwd(), "public", "uploads", key);
    return fs.readFile(filePath);
  }
}

// ── Signed URL (for browser access) ─────────────────────
export async function getDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (r2 && !key.startsWith("/")) {
    return getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn }
    );
  } else {
    // Dev: return the local public path directly
    return key;
  }
}

// ── Delete ──────────────────────────────────────────────
export async function deleteFile(key: string): Promise<void> {
  if (r2 && !key.startsWith("/")) {
    await r2.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    );
  } else {
    const fs = await import("fs/promises");
    const filePath = key.startsWith("/")
      ? path.join(process.cwd(), "public", key)
      : path.join(process.cwd(), "public", "uploads", key);
    await fs.unlink(filePath).catch(() => {});
  }
}

// ── Hash ────────────────────────────────────────────────
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
