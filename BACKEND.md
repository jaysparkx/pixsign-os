# BACKEND.md
## eSign MVP — Backend Reference

All backend code lives in `src/app/api/` (API routes) and `src/lib/` (shared utilities).  
Runtime: Node.js via Next.js App Router. No separate Express/Fastify server.

---

## LIB FILES

### `src/lib/prisma.ts` — Database client singleton
```typescript
import { PrismaClient } from "@prisma/client"

const g = globalThis as any
export const prisma: PrismaClient = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") g.prisma = prisma
export default prisma
```
Import this in every API route that needs the database. Never instantiate `PrismaClient` elsewhere.

---

### `src/lib/storage.ts` — File system helpers

```typescript
import fs from "fs"
import path from "path"
import { v4 as uuid } from "uuid"
import crypto from "crypto"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// Auto-create sub-folders on startup
["originals", "signed", "signatures"].forEach(f =>
  fs.mkdirSync(path.join(UPLOAD_DIR, f), { recursive: true })
)

// Save buffer to disk, return public URL path
export function saveFile(
  buffer: Buffer,
  folder: "originals" | "signed" | "signatures",
  ext = "pdf"
): string {
  const filename = `${uuid()}.${ext}`
  fs.writeFileSync(path.join(UPLOAD_DIR, folder, filename), buffer)
  return `/uploads/${folder}/${filename}`
}

// Read file from public URL path, return Buffer
export function readFile(urlPath: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "public", urlPath))
}

// SHA-256 hash of buffer
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}
```

---

### `src/lib/events.ts` — Event logging

```typescript
import prisma from "./prisma"

export async function log(
  documentId: string,
  type: string,
  recipientId?: string,
  ip?: string,
  meta?: object
) {
  return prisma.event.create({
    data: {
      documentId,
      recipientId: recipientId || null,
      type,
      ip: ip || null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  })
}

export function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
}
```

**Event types used throughout the app:**
- `DOCUMENT_CREATED` — logged on upload
- `DOCUMENT_SENT` — logged when sender clicks Send
- `DOCUMENT_COMPLETED` — logged after finalization
- `DOCUMENT_VOIDED` — logged on void
- `EMAIL_SENT` — logged per recipient email
- `RECIPIENT_VIEWED` — logged first time signer opens link
- `RECIPIENT_SIGNED` — logged when signer submits
- `RECIPIENT_DECLINED` — logged when signer declines
- `FIELD_SIGNED` — logged per field completed
- `DOWNLOAD` — logged on download

---

### `src/lib/email.ts` — Nodemailer email functions

**Transporter setup:**
```typescript
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

const FROM = `"${process.env.EMAIL_FROM_NAME || "eSign"}" <${process.env.EMAIL_FROM}>`
```

**Three email functions:**

```typescript
// 1. Signing request (sent to each signer)
export async function sendSigningRequest(args: {
  to: string
  toName: string
  senderName: string
  docTitle: string
  message?: string
  signingUrl: string
  expiresAt?: Date
}): Promise<void>

// 2. Completion notification (sent to all parties when fully signed)
export async function sendCompletionEmail(args: {
  to: string
  toName: string
  docTitle: string
  downloadUrl: string
}): Promise<void>

// 3. Decline notification (sent to document owner)
export async function sendDeclinedEmail(args: {
  to: string
  toName: string
  declinerName: string
  docTitle: string
  reason?: string
}): Promise<void>
```

All email templates are dark-themed HTML, built inline (no template files needed).

---

### `src/lib/pdf.ts` — PDF processing

```typescript
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import prisma from "./prisma"
import { readFile, saveFile, hashBuffer } from "./storage"

// Validate PDF and return page count
export async function validatePdf(buffer: Buffer): Promise<{ pages: number }>

// Finalize document: embed fields + append audit page + save signed PDF
export async function finalizeDocument(documentId: string): Promise<void>
```

**`validatePdf` implementation:**
```typescript
export async function validatePdf(buffer: Buffer): Promise<{ pages: number }> {
  const doc = await PDFDocument.load(buffer)  // throws on invalid PDF
  return { pages: doc.getPageCount() }
}
```

**`finalizeDocument` — full flow:**
```typescript
export async function finalizeDocument(documentId: string): Promise<void> {
  // 1. Load document + related data
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      fields: { include: { recipient: true } },
      recipients: true,
      events: { orderBy: { createdAt: "asc" } },
    }
  })

  // 2. Load original PDF bytes
  const originalBuffer = readFile(doc.originalPath)
  const pdfDoc = await PDFDocument.load(originalBuffer)
  const pages = pdfDoc.getPages()

  // 3. Embed each completed field onto correct page
  for (const field of doc.fields) {
    if (!field.signedAt || !field.value) continue
    const page = pages[field.page - 1]
    const { height: pageHeight } = page.getSize()
    const pdfY = pageHeight - field.y - field.height  // flip Y axis

    if (field.type === "SIGNATURE" || field.type === "INITIALS") {
      const base64 = field.value.replace(/^data:image\/png;base64,/, "")
      const imgBuffer = Buffer.from(base64, "base64")
      const img = await pdfDoc.embedPng(imgBuffer)
      page.drawImage(img, { x: field.x, y: pdfY, width: field.width, height: field.height })
    }
    else if (field.type === "CHECKBOX") {
      page.drawRectangle({ x: field.x, y: pdfY, width: field.width, height: field.height, borderColor: rgb(0.3,0.3,0.5), borderWidth: 1 })
      if (field.value === "true") {
        page.drawText("✓", { x: field.x+2, y: pdfY+2, size: field.height-4, font: fontBold, color: rgb(0.1,0.66,0.4) })
      }
    }
    else {
      // TEXT, DATE, NAME, EMAIL
      page.drawRectangle({ x: field.x, y: pdfY, width: field.width, height: field.height, color: rgb(0.97,0.97,1), borderColor: rgb(0.7,0.7,0.85), borderWidth: 0.5 })
      page.drawText(field.value, { x: field.x+4, y: pdfY + field.height/2 - 5, size: 11, font, color: rgb(0.1,0.1,0.2) })
    }
  }

  // 4. Append audit trail page (see audit page spec below)
  appendAuditPage(pdfDoc, doc)

  // 5. Save + update DB
  const finalBytes = await pdfDoc.save()
  const finalBuffer = Buffer.from(finalBytes)
  const signedHash = hashBuffer(finalBuffer)
  const signedPath = saveFile(finalBuffer, "signed", "pdf")

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "COMPLETED", signedPath, signedHash, completedAt: new Date() }
  })
}
```

**Audit page spec:**
The audit page is a new page appended to the signed PDF. Content:
- Dark header bar: "AUDIT CERTIFICATE" + generation timestamp
- Document section: title, document ID
- Integrity section: original SHA-256 hash (stored at upload time)
- Signers section: for each recipient — name, email, IP, signed timestamp (or PENDING)
- Activity log: last 15 events from `events` table
- Footer: platform certification statement

---

## API ROUTES — FULL SPECIFICATION

### `POST /api/documents/upload`
```typescript
export const runtime = "nodejs"

// Input: multipart/form-data
// - file: File (PDF only, max 50MB)
// - title: string (optional, defaults to filename)

// Process:
// 1. Validate file type and size
// 2. Convert to Buffer
// 3. Call validatePdf(buffer) — throws if invalid
// 4. saveFile(buffer, "originals") → originalPath
// 5. hashBuffer(buffer) → originalHash
// 6. prisma.document.create(...)
// 7. log(doc.id, "DOCUMENT_CREATED")

// Response 200:
{ id: string, title: string, pages: number }

// Response 400: invalid file, too large, not PDF
// Response 500: storage or DB failure
```

---

### `GET /api/documents`
```typescript
// Returns all documents ordered by createdAt desc
// Includes: recipients (for avatar display), _count.fields

// Response: Document[]
```

---

### `GET /api/documents/:id`
```typescript
// Returns full document with:
// - fields (include: recipient)
// - recipients

// Response 404 if not found
```

---

### `PATCH /api/documents/:id`
```typescript
// Input JSON (all optional):
{ title?, message?, senderName?, signingOrder?, expiresAt? }

// Only updates fields that are provided (partial update)
// No status restriction — title/message can be updated anytime
```

---

### `DELETE /api/documents/:id`
```typescript
// Only allowed if status === "DRAFT"
// Cascades to fields, recipients, events (Prisma onDelete: Cascade)
```

---

### `POST /api/documents/:id/send`
```typescript
export const runtime = "nodejs"

// Input JSON:
{ senderName?: string }

// Guards:
// - doc.status must be "DRAFT"
// - must have at least one SIGNER recipient

// Process:
// 1. Update doc: { status: "SENT", senderName }
// 2. log(id, "DOCUMENT_SENT")
// 3. Determine recipients to notify:
//    - PARALLEL: all SIGNER recipients
//    - SEQUENTIAL: only the recipient with lowest signingOrder
// 4. For each to-notify recipient:
//    a. Build signingUrl = `${APP_URL}/sign/${docId}/${recipient.token}`
//    b. sendSigningRequest({...}) — wrapped in try/catch
//    c. Update recipient: { status: "SENT", emailSentAt: now }
//    d. log(id, "EMAIL_SENT", recipientId)

// Response: { ok: true }
```

---

### `POST /api/documents/:id/void`
```typescript
// Input JSON:
{ reason?: string }

// Guards: status not in ["COMPLETED", "VOIDED"]

// Process:
// 1. Update doc: { status: "VOIDED", voidedAt: now, voidReason: reason }
// 2. log(id, "DOCUMENT_VOIDED", undefined, undefined, { reason })

// Response: { ok: true }
```

---

### `GET /api/documents/:id/download`
```typescript
export const runtime = "nodejs"

// Returns the signed PDF if available, otherwise original PDF
// Sets Content-Disposition: attachment; filename="..."
// Logs DOWNLOAD event

// Response: PDF binary stream
// Response 404 if document not found
```

---

### `GET /api/documents/:id/analytics`
```typescript
// Returns:
{
  doc: { id, title, status, createdAt, completedAt, expiresAt },
  stats: {
    totalSigners: number,
    signedCount: number,
    completionRate: number,   // 0-100
    totalFields: number,
    completedFields: number,
  },
  recipients: Recipient[],    // full recipient objects with timestamps + IP
  timeline: {                 // all events
    id, type, createdAt,
    recipient: string | null,  // "Name <email>" or null
    ip: string | null
  }[]
}
```

---

### `GET /api/documents/:id/fields`
```typescript
// Returns Field[] for document, including recipient data
```

---

### `PUT /api/documents/:id/fields`
```typescript
// Input JSON:
{ fields: FieldInput[] }

// FieldInput:
{
  recipientId: string | null
  page: number
  x: number
  y: number
  width: number
  height: number
  type: string
  label?: string
  required?: boolean
}

// Process:
// 1. Guard: doc.status must be "DRAFT"
// 2. DELETE all existing fields for this document
// 3. CREATE all new fields from input
// 4. Return newly created Field[] with recipients

// Note: This is a bulk replace, not patch. The editor always sends all fields.
```

---

### `GET /api/documents/:id/recipients`
```typescript
// Returns Recipient[] ordered by signingOrder ASC
```

---

### `POST /api/documents/:id/recipients`
```typescript
// Input JSON:
{ name: string, email: string, role?: "SIGNER"|"CC", signingOrder?: number }

// Guards:
// - doc.status must be "DRAFT"
// - email must not already exist for this document

// signingOrder defaults to (max existing + 1)

// Response 201: { id, name, email, role, signingOrder, status, token, ... }
// Response 400: missing fields, duplicate email
```

---

### `DELETE /api/documents/:id/recipients/:rid`
```typescript
// Process:
// 1. Unassign all fields with recipientId === rid (set to null)
// 2. Delete recipient

// No status guard — can remove from DRAFT only (caller should check)
```

---

### `GET /api/sign/:docId/:token`
```typescript
// No auth required — public endpoint

// Validation:
// 1. Find recipient by token
// 2. Verify recipient.documentId === docId (prevent token-swapping)
// 3. Check document status (voided/expired/completed)
// 4. Check recipient status (already signed/declined)
// 5. Mark as viewed (first time only)

// Possible responses:
{ error: "Invalid or expired link" }               // status 404
{ error: "This document has been voided" }         // status 410
{ error: "This document has expired" }             // status 410
{ completed: true, signedPath: string }            // all signed
{ alreadySigned: true }                            // this recipient already signed
{ declined: true }                                 // this recipient declined

// Success response:
{
  recipient: { id, name, email },
  document: { id, title, message, pdfUrl },
  fields: [                                        // ONLY fields for this recipient
    { id, page, x, y, width, height, type, label, required }
  ]
}
```

---

### `POST /api/sign/:docId/:token/submit`
```typescript
export const runtime = "nodejs"

// Input JSON:
{
  consent: boolean,           // must be true
  fields: [
    {
      id: string,             // field ID
      value?: string,         // for text/date/checkbox/name/email
      sigDataUrl?: string     // for signature/initials: data:image/png;base64,...
    }
  ]
}

// Validation:
// 1. Token valid + docId matches
// 2. Recipient not already signed
// 3. consent === true
// 4. For each field:
//    - field.recipientId === recipient.id (ownership check)
//    - field.required → must have value or sigDataUrl

// Process:
// 1. Save each field: update { value or sigDataUrl stored in .value, signedAt: now }
// 2. Update recipient: { status: "SIGNED", signedAt: now, ipAddress }
// 3. Log RECIPIENT_SIGNED
// 4. Check completion:
//    const allSigned = signers.every(r => r.status === "SIGNED")
//    if allSigned:
//      await finalizeDocument(docId)
//      send completion emails to all recipients
//    else if SEQUENTIAL:
//      find and email next signer
//      update doc status to PARTIALLY_SIGNED
//    else (PARALLEL):
//      update doc status to PARTIALLY_SIGNED
```

---

### `POST /api/sign/:docId/:token/decline`
```typescript
// Input JSON:
{ reason?: string }

// Process:
// 1. Update recipient: { status: "DECLINED", declinedAt: now, declineReason }
// 2. Update document: { status: "DECLINED" }
// 3. Log RECIPIENT_DECLINED

// Response: { ok: true }
```

---

## PRISMA SCHEMA (SQLite)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Document {
  id           String      @id @default(uuid())
  title        String
  status       String      @default("DRAFT")
  signingOrder String      @default("PARALLEL")
  message      String?
  expiresAt    DateTime?
  completedAt  DateTime?
  voidedAt     DateTime?
  voidReason   String?
  originalPath String
  signedPath   String?
  originalHash String
  signedHash   String?
  senderName   String      @default("Document Sender")
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  fields       Field[]
  recipients   Recipient[]
  events       Event[]
}

model Field {
  id          String     @id @default(uuid())
  documentId  String
  document    Document   @relation(fields: [documentId], references: [id], onDelete: Cascade)
  recipientId String?
  recipient   Recipient? @relation(fields: [recipientId], references: [id], onDelete: SetNull)
  page        Int
  x           Float
  y           Float
  width       Float
  height      Float
  type        String
  label       String?
  required    Boolean    @default(true)
  value       String?
  signedAt    DateTime?
  createdAt   DateTime   @default(now())
}

model Recipient {
  id            String    @id @default(uuid())
  documentId    String
  document      Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  name          String
  email         String
  role          String    @default("SIGNER")
  signingOrder  Int       @default(1)
  status        String    @default("PENDING")
  token         String    @unique @default(uuid())
  emailSentAt   DateTime?
  viewedAt      DateTime?
  signedAt      DateTime?
  declinedAt    DateTime?
  declineReason String?
  ipAddress     String?
  createdAt     DateTime  @default(now())
  fields        Field[]
  events        Event[]
}

model Event {
  id          String     @id @default(uuid())
  documentId  String
  document    Document   @relation(fields: [documentId], references: [id], onDelete: Cascade)
  recipientId String?
  recipient   Recipient? @relation(fields: [recipientId], references: [id])
  type        String
  ip          String?
  meta        String?
  createdAt   DateTime   @default(now())
}
```

---

## COMMON BACKEND PATTERNS

### Guard pattern
```typescript
const doc = await prisma.document.findUnique({ where: { id: params.id } })
if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
if (doc.status !== "DRAFT") return NextResponse.json({ error: "Not a draft" }, { status: 400 })
```

### Partial JSON body with defaults
```typescript
const body = await req.json().catch(() => ({}))
const senderName = body.senderName || doc.senderName || "Document Sender"
```

### Check all signers complete
```typescript
const allRecipients = await prisma.recipient.findMany({ where: { documentId } })
const signers = allRecipients.filter(r => r.role === "SIGNER")
const allSigned = signers.every(r => r.id === currentRecipientId ? true : r.status === "SIGNED")
```

### Find next sequential signer
```typescript
const nextSigner = allRecipients
  .filter(r => r.role === "SIGNER" && r.status !== "SIGNED" && r.status !== "DECLINED")
  .sort((a, b) => a.signingOrder - b.signingOrder)[0]
```

### Build signing URL
```typescript
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const signingUrl = `${APP}/sign/${documentId}/${recipient.token}`
```

### Build download URL
```typescript
const downloadUrl = `${APP}/api/documents/${documentId}/download`
```
