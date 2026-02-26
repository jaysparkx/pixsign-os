# INSTRUCTIONS.md
## eSign MVP — AI Agent Master Guide

You are building **eSign**, a full-stack electronic signature platform similar to PandaDoc.
This document is your primary reference. Read it fully before writing any code.
Cross-reference `backend.md`, `frontend.md`, and `rules.md` for detailed implementation specs.

---

## 1. PROJECT IDENTITY

**Name:** eSign MVP  
**Purpose:** Allow users to upload PDFs, place signature/field boxes on them, send to recipients via email, collect legally-binding e-signatures, and download the finalized signed PDF with an audit trail.  
**Stack:** Next.js 14 (App Router, full-stack) · Prisma ORM · SQLite (dev) / PostgreSQL (prod) · Local file storage (dev) / Cloudflare R2 (prod) · Nodemailer · pdf-lib · PDF.js  
**Auth:** None — this is an MVP. No login, no signup.

---

## 2. CORE USER FLOWS

Understand these flows deeply. Every feature exists to serve one of these two paths.

### Flow A — Sender (document owner)
```
1. Upload PDF → /documents/:id/prepare
2. Open field editor → drag fields onto PDF pages
3. Add recipients → assign fields to each recipient
4. Save fields → back to /documents/:id
5. Enter sender name → click "Send for Signature"
6. Emails sent to signers with unique signing links
7. Monitor progress at /documents/:id (or /documents/:id/analytics)
8. Once all signed → download completed PDF
```

### Flow B — Signer (recipient, no account needed)
```
1. Receives email with link → /sign/:docId/:token
2. Sees PDF with their assigned fields highlighted
3. Clicks signature field → modal opens
4. Draw / type / upload their signature
5. Fill in any text/date/checkbox fields
6. Click "Complete Signing" → consent modal
7. Confirm → submitted
8. Receives completion email when all parties sign
```

---

## 3. DOCUMENT LIFECYCLE (status machine)

```
DRAFT → SENT → PARTIALLY_SIGNED → COMPLETED
                      ↓                ↓
                  DECLINED           (done)
DRAFT → VOIDED
SENT  → VOIDED
SENT  → EXPIRED (when expiresAt passes)
```

**Rules:**
- Only DRAFT documents can have fields/recipients edited
- Only DRAFT documents can be sent
- COMPLETED, VOIDED documents cannot be voided again
- On last signer completing → trigger `finalizeDocument()` → status = COMPLETED

---

## 4. DATA MODELS (SQLite/Prisma)

### Document
| field | type | notes |
|---|---|---|
| id | uuid | primary key |
| title | string | |
| status | string | DRAFT/SENT/PARTIALLY_SIGNED/COMPLETED/DECLINED/EXPIRED/VOIDED |
| signingOrder | string | PARALLEL or SEQUENTIAL |
| message | string? | shown to signers |
| expiresAt | datetime? | |
| completedAt | datetime? | |
| voidedAt | datetime? | |
| voidReason | string? | |
| originalPath | string | `/uploads/originals/xxx.pdf` — public URL path |
| signedPath | string? | `/uploads/signed/xxx.pdf` |
| originalHash | string | SHA-256 of original file |
| signedHash | string? | SHA-256 of finalized file |
| senderName | string | default "Document Sender" |

### Field
| field | type | notes |
|---|---|---|
| id | uuid | |
| documentId | string | FK → Document |
| recipientId | string? | FK → Recipient (null = unassigned) |
| page | int | 1-indexed |
| x | float | px from left, at natural PDF scale |
| y | float | px from top, at natural PDF scale |
| width | float | px at natural PDF scale |
| height | float | px at natural PDF scale |
| type | string | SIGNATURE/INITIALS/DATE/TEXT/CHECKBOX/NAME/EMAIL |
| label | string? | display label |
| required | bool | default true |
| value | string? | filled in by signer (base64 dataURL for signatures) |
| signedAt | datetime? | when this field was completed |

### Recipient
| field | type | notes |
|---|---|---|
| id | uuid | |
| documentId | string | FK → Document |
| name | string | |
| email | string | |
| role | string | SIGNER or CC |
| signingOrder | int | 1-based, used for sequential mode |
| status | string | PENDING/SENT/VIEWED/SIGNED/DECLINED |
| token | uuid | unique signing link token |
| emailSentAt | datetime? | |
| viewedAt | datetime? | |
| signedAt | datetime? | |
| declinedAt | datetime? | |
| declineReason | string? | |
| ipAddress | string? | captured at signing time |

### Event
| field | type | notes |
|---|---|---|
| id | uuid | |
| documentId | string | FK → Document |
| recipientId | string? | FK → Recipient |
| type | string | see event types below |
| ip | string? | |
| meta | string? | JSON string for extra data |
| createdAt | datetime | |

**Event types:** `DOCUMENT_CREATED` `DOCUMENT_SENT` `DOCUMENT_VOIDED` `DOCUMENT_COMPLETED` `EMAIL_SENT` `RECIPIENT_VIEWED` `RECIPIENT_SIGNED` `RECIPIENT_DECLINED` `FIELD_SIGNED` `DOWNLOAD`

---

## 5. API SURFACE

All routes live under `/api/`. No auth required.

### Documents
```
GET    /api/documents                    → list all documents
POST   /api/documents/upload             → upload PDF (multipart/form-data)
GET    /api/documents/:id                → get document with fields + recipients
PATCH  /api/documents/:id                → update title/message/senderName/signingOrder/expiresAt
DELETE /api/documents/:id                → delete (DRAFT only)
POST   /api/documents/:id/send           → send for signatures, triggers emails
POST   /api/documents/:id/void           → void with optional reason
GET    /api/documents/:id/download       → stream the PDF file
GET    /api/documents/:id/analytics      → analytics data
GET    /api/documents/:id/fields         → list fields
PUT    /api/documents/:id/fields         → bulk replace all fields (used by editor)
GET    /api/documents/:id/recipients     → list recipients
POST   /api/documents/:id/recipients     → add recipient
DELETE /api/documents/:id/recipients/:rid → remove recipient
```

### Signing (public, no auth)
```
GET    /api/sign/:docId/:token           → load signing session (validates token, marks viewed)
POST   /api/sign/:docId/:token/submit    → submit all field values + signatures
POST   /api/sign/:docId/:token/decline   → decline to sign
```

---

## 6. FILE STORAGE

**Dev:** Local filesystem at `/public/uploads/`
```
/public/uploads/originals/   ← uploaded PDFs
/public/uploads/signed/      ← finalized signed PDFs
/public/uploads/signatures/  ← signature images (if stored separately)
```
Files are accessible as static Next.js public assets via `/uploads/...` URLs.

**Storage helpers** live in `src/lib/storage.ts`:
- `saveFile(buffer, folder, ext)` → returns public URL path
- `readFile(urlPath)` → returns Buffer
- `hashBuffer(buffer)` → returns SHA-256 hex string

**Prod upgrade path:** Swap `storage.ts` to use Cloudflare R2 (S3-compatible). All other code stays the same because everything uses the helper functions.

---

## 7. PDF PROCESSING

### Upload-time validation
```typescript
import { validatePdf } from "@/lib/pdf"
const { pages } = await validatePdf(buffer)  // throws if invalid
```

### Finalization (called when all signers complete)
```typescript
import { finalizeDocument } from "@/lib/pdf"
await finalizeDocument(documentId)
```

**What finalization does:**
1. Load original PDF from `/public/uploads/originals/`
2. For each completed field:
   - SIGNATURE/INITIALS → decode base64 PNG from `field.value`, embed at coordinates
   - TEXT/DATE/NAME/EMAIL → draw text string at field position
   - CHECKBOX → draw rectangle + checkmark if `field.value === "true"`
3. Append a new audit trail page (dark-themed, shows all signers, IPs, timestamps, document hash)
4. Save finalized PDF to `/public/uploads/signed/`
5. Update `document.signedPath`, `document.signedHash`, `document.status = "COMPLETED"`, `document.completedAt`

### Coordinate system
- Fields stored at **natural PDF scale** (what PDF.js reports at scale=1)
- PDF.js renders at scale=2 for retina, so divide rendered positions by 2 to get natural
- pdf-lib uses **bottom-left origin**, browser uses **top-left origin**
- Conversion: `pdfY = pageHeight - field.y - field.height`

---

## 8. EMAIL SYSTEM

**Library:** Nodemailer with SMTP (Gmail or any SMTP provider)  
**Config:** SMTP credentials in `.env.local`  
**Templates:** HTML-in-code, dark-themed branded emails

### Email functions in `src/lib/email.ts`
```typescript
sendSigningRequest({ to, toName, senderName, docTitle, message?, signingUrl, expiresAt? })
sendCompletionEmail({ to, toName, docTitle, downloadUrl })
sendDeclinedEmail({ to, toName, declinerName, docTitle, reason? })
```

### Signing URL format
```
{NEXT_PUBLIC_APP_URL}/sign/{documentId}/{recipientToken}
```

---

## 9. SEQUENTIAL vs PARALLEL SIGNING

**PARALLEL (default):** Send emails to all signers simultaneously when document is sent.

**SEQUENTIAL:** 
- On send → only email `signingOrder = 1` signer
- When signer N completes → email signer N+1
- Check "next signer" = lowest `signingOrder` among recipients with status PENDING/SENT

---

## 10. SIGNING SESSION LOGIC

When `GET /api/sign/:docId/:token` is called:

```
1. Find recipient by token
2. Verify recipient.documentId === docId
3. Check document status:
   - VOIDED → return { error: "voided" }
   - COMPLETED → return { completed: true }
   - expiresAt < now → update to EXPIRED, return { error: "expired" }
4. Check recipient status:
   - SIGNED → return { alreadySigned: true }
   - DECLINED → return { declined: true }
5. If not yet viewed → update recipient: { viewedAt: now, status: "VIEWED", ipAddress }
6. Log RECIPIENT_VIEWED event
7. Return: { recipient, document, fields } (only fields assigned to this recipient)
```

When `POST /api/sign/:docId/:token/submit` is called:

```
1. Validate token + docId
2. Check recipient not already signed
3. Validate consent = true
4. For each field in payload:
   - Verify field.recipientId === recipient.id
   - Check required fields have values
   - Save: field.value = sigDataUrl (for sig/initials) or value (for others)
   - Set field.signedAt = now
5. Update recipient: { status: "SIGNED", signedAt: now, ipAddress }
6. Log RECIPIENT_SIGNED event
7. Check if all signers complete:
   - Yes → call finalizeDocument(), send completion emails
   - No (sequential) → email next signer
   - No (parallel) → update doc status to PARTIALLY_SIGNED
8. Return { ok: true }
```

---

## 11. ENVIRONMENT VARIABLES

```bash
# Required
NEXT_PUBLIC_APP_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=you@gmail.com
EMAIL_FROM_NAME=eSign

# Optional
EMAIL_SUBJECT_PREFIX=[eSign]
```

Database is SQLite at `prisma/dev.db` — no env var needed for dev.

---

## 12. DIRECTORY STRUCTURE

```
esign-mvp/
├── prisma/
│   └── schema.prisma              # SQLite schema
├── public/
│   └── uploads/                   # Auto-created: originals/ signed/ signatures/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx               # Dashboard — document list + upload
│   │   ├── documents/
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Document detail + send flow
│   │   │       ├── prepare/
│   │   │       │   └── page.tsx   # PDF field editor
│   │   │       └── analytics/
│   │   │           └── page.tsx   # Analytics dashboard
│   │   ├── sign/
│   │   │   └── [docId]/
│   │   │       └── [token]/
│   │   │           └── page.tsx   # Signer-facing signing experience
│   │   └── api/
│   │       ├── documents/
│   │       │   ├── route.ts
│   │       │   ├── upload/route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── send/route.ts
│   │       │       ├── void/route.ts
│   │       │       ├── download/route.ts
│   │       │       ├── analytics/route.ts
│   │       │       ├── fields/route.ts
│   │       │       └── recipients/
│   │       │           ├── route.ts
│   │       │           └── [rid]/route.ts
│   │       └── sign/
│   │           └── [docId]/
│   │               └── [token]/
│   │                   ├── route.ts
│   │                   ├── submit/route.ts
│   │                   └── decline/route.ts
│   └── lib/
│       ├── prisma.ts              # Prisma singleton
│       ├── storage.ts             # File save/read/hash
│       ├── email.ts               # Nodemailer + templates
│       ├── pdf.ts                 # pdf-lib: validate + finalize
│       └── events.ts              # Event logger + IP extractor
└── .env.local                     # Your config (copy from .env.example)
```

---

## 13. SETUP COMMANDS

```bash
npm install
cp .env.example .env.local
# edit .env.local with your SMTP credentials
npx prisma db push
npm run dev
```

---

## 14. COMMON GOTCHAS

1. **PDF coordinate flip:** pdf-lib Y axis is flipped vs browser. Always use `pdfY = pageHeight - field.y - field.height` when drawing.

2. **Scale factor:** Store field coordinates at natural PDF scale. When rendering in browser (PDF.js at scale=2), multiply all coordinates by the display scale. Never store scaled coordinates.

3. **Base64 signatures:** Field.value for SIGNATURE/INITIALS stores the full data URL (`data:image/png;base64,...`). Strip the prefix before decoding: `field.value.replace(/^data:image\/png;base64,/, '')`.

4. **Sequential signing check:** When finding "next signer", filter by `role === "SIGNER"` AND `status !== "SIGNED"`, then pick the one with lowest `signingOrder`.

5. **Finalization timing:** Only trigger `finalizeDocument()` when ALL recipients with `role === "SIGNER"` have `status === "SIGNED"`. CC recipients don't need to sign.

6. **File paths vs URLs:** `storage.ts` returns URL paths like `/uploads/originals/xxx.pdf` (for serving to browser). To read the file on disk: `path.join(process.cwd(), 'public', urlPath)`.

7. **Next.js API runtime:** PDF processing routes must have `export const runtime = "nodejs"` at the top — they can't run in the Edge runtime.

8. **Prisma in Next.js:** Always use the singleton from `src/lib/prisma.ts`. Never `new PrismaClient()` in route files — it causes connection exhaustion.
