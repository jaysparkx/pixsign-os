import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Auto-create folders
["originals", "signed", "signatures"].forEach((f) => {
  fs.mkdirSync(path.join(UPLOAD_DIR, f), { recursive: true });
});

export function saveFile(buffer: Buffer, folder: "originals" | "signed" | "signatures", ext = "pdf"): string {
  const filename = `${uuid()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, folder, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${folder}/${filename}`; // public URL path
}

export function readFile(urlPath: string): Buffer {
  const filePath = path.join(process.cwd(), "public", urlPath);
  return fs.readFileSync(filePath);
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
