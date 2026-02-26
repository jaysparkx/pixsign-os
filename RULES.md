# RULES.md
## eSign MVP — Non-Negotiable Rules

These rules apply to every file, every function, every line of code. No exceptions.

---

## RULE 1 — KEEP IT SIMPLE

This is an MVP. Do not add:
- Authentication / sessions / JWT / cookies
- Role-based access control
- Redis, queues, workers, BullMQ
- Cloudflare R2, AWS S3, or any cloud storage
- Third-party image optimization services
- WebSockets or server-sent events
- Rate limiting middleware
- Feature flags
- Anything not explicitly described in INSTRUCTIONS.md

If a feature is not in the spec, **do not build it**. Ask first.

---

## RULE 2 — NEXT.JS APP ROUTER PATTERNS

```typescript
// ✅ Correct — server component (default)
export default async function Page() { ... }

// ✅ Correct — client component
"use client";
export default function Page() { ... }

// ✅ Correct — API route
export async function GET(req: NextRequest, { params }: { params: { id: string } }) { ... }

// ❌ Wrong — never use pages/ router
// ❌ Wrong — never use getServerSideProps / getStaticProps
// ❌ Wrong — never mix async server logic into "use client" components
```

---

## RULE 3 — PRISMA SINGLETON

Always import from `@/lib/prisma`. Never instantiate directly.

```typescript
// ✅
import prisma from "@/lib/prisma"
const doc = await prisma.document.findUnique({ where: { id } })

// ❌
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()  // connection leak
```

---

## RULE 4 — API ROUTES MUST HANDLE ERRORS

Every API route wraps its body in try/catch and returns proper HTTP status codes.

```typescript
// ✅
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: params.id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(doc)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// ❌ — no error handling
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  return NextResponse.json(doc)
}
```

---

## RULE 5 — PDF PROCESSING REQUIRES NODEJS RUNTIME

Any API route that touches the filesystem, pdf-lib, or nodemailer must declare:

```typescript
export const runtime = "nodejs"
```

This goes at the **top of the file**, before any functions.

---

## RULE 6 — FILE PATHS VS URL PATHS

Storage functions return **URL paths** (e.g., `/uploads/originals/abc.pdf`).  
To read from disk, prepend `process.cwd() + "/public"`.

```typescript
// storage.ts returns:
"/uploads/originals/abc.pdf"  // URL path

// To serve to browser — use as-is in <img src> or href

// To read on server:
const buffer = readFile("/uploads/originals/abc.pdf")
// internally: fs.readFileSync(path.join(process.cwd(), "public", urlPath))
```

Never construct file paths manually in route files. Always use `src/lib/storage.ts` helpers.

---

## RULE 7 — COORDINATE SYSTEM

Fields are stored at **natural PDF scale** (PDF.js scale=1 units).

```typescript
// ✅ Store in DB at natural scale
field.x = 120      // natural PDF units
field.y = 340      // natural PDF units (top-left origin)

// ✅ Display in browser — multiply by current display scale
<div style={{ left: field.x * scale, top: field.y * scale }} />

// ✅ Embed in PDF with pdf-lib — flip Y axis
const pdfY = pageHeight - field.y - field.height

// ❌ Never store scaled coordinates in the database
// ❌ Never pass browser pixel coordinates directly to pdf-lib
```

---

## RULE 8 — TYPESCRIPT TYPES

Use TypeScript strictly. No `any` unless absolutely unavoidable (e.g., Prisma JSON fields).

```typescript
// ✅
interface Field {
  id: string
  page: number
  x: number
  y: number
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX" | "NAME" | "EMAIL"
  recipientId: string | null
  required: boolean
}

// ❌
const field: any = { ... }
```

---

## RULE 9 — CLIENT COMPONENTS

Client components (`"use client"`) must:
- Never import from `@/lib/prisma`, `@/lib/storage`, `@/lib/pdf`, `@/lib/email` (server-only libs)
- Always handle loading and error states
- Always show feedback on async actions (toast or loading spinner)
- Never make direct DB calls — only call API routes via `fetch()`

```typescript
// ✅ Client component fetches via API
const res = await fetch(`/api/documents/${id}`)
const data = await res.json()
if (!res.ok) toast.error(data.error)

// ❌ Client component imports server lib
import prisma from "@/lib/prisma"  // will crash at build time
```

---

## RULE 10 — FORM SUBMISSIONS

Never use HTML `<form>` with action. Use button `onClick` + `fetch()`.

```typescript
// ✅
<button onClick={async () => {
  const res = await fetch("/api/documents/upload", { method: "POST", body: formData })
  ...
}}>Upload</button>

// ❌
<form action="/api/documents/upload" method="POST">
```

---

## RULE 11 — EMAIL IS BEST-EFFORT

Email failures must never break the main flow. Always wrap email calls:

```typescript
// ✅
try {
  await sendSigningRequest({ ... })
} catch (err) {
  console.error("Email failed (non-fatal):", err)
  // continue — don't throw, don't return error response
}
```

---

## RULE 12 — SEQUENTIAL SIGNING LOGIC

When checking for the next signer, always filter strictly:

```typescript
// ✅ Correct
const nextSigner = allRecipients
  .filter(r => r.role === "SIGNER" && r.status !== "SIGNED" && r.status !== "DECLINED")
  .sort((a, b) => a.signingOrder - b.signingOrder)[0]

// ❌ Wrong — misses declined recipients
const nextSigner = allRecipients.find(r => r.status === "PENDING")
```

---

## RULE 13 — DOCUMENT MUTATION GUARDS

Before mutating documents, always check status:

```typescript
// Fields/recipients — only editable in DRAFT
if (doc.status !== "DRAFT") {
  return NextResponse.json({ error: "Document is not in draft" }, { status: 400 })
}

// Send — only from DRAFT
if (doc.status !== "DRAFT") {
  return NextResponse.json({ error: "Document already sent" }, { status: 400 })
}

// Void — not if already COMPLETED or VOIDED
if (["COMPLETED", "VOIDED"].includes(doc.status)) {
  return NextResponse.json({ error: "Cannot void this document" }, { status: 400 })
}
```

---

## RULE 14 — SIGNING REQUIRES CONSENT

The submit endpoint must reject requests without `consent: true`:

```typescript
const { fields, consent } = await req.json()
if (!consent) {
  return NextResponse.json({ error: "Consent required" }, { status: 400 })
}
```

The frontend must show a consent modal before calling submit. Never auto-submit without showing the consent dialog.

---

## RULE 15 — UI CONSISTENCY

The app uses a single dark theme. Colors via Tailwind:
- Background: `bg-ink-950` (#0a0a1a)
- Cards: `bg-ink-900` border `border-ink-800`
- Primary action: `bg-brand-500` (#ff1a6b) hover `bg-brand-600`
- Success/signed: `bg-ok-500` (#18a867) text `text-ok-400`
- Text primary: `text-white` or `text-ink-100`
- Text muted: `text-ink-400` or `text-ink-500`

Never introduce new color values. Use only the palette defined in `tailwind.config.ts`.

---

## RULE 16 — NO INLINE STYLES FOR LAYOUT

Use Tailwind classes for layout. Inline styles only for dynamic values (positions, colors from data):

```typescript
// ✅ Dynamic position — inline style is correct
<div style={{ left: field.x * scale, top: field.y * scale, width: field.width * scale }} />

// ✅ Static layout — use Tailwind
<div className="flex items-center gap-4 px-6 py-3" />

// ❌ Static layout as inline style
<div style={{ display: "flex", alignItems: "center", gap: "1rem" }} />
```

---

## RULE 17 — LOADING STATES

Every async page and action must have a visible loading state:

```typescript
// Page loading
if (loading) return (
  <div className="min-h-screen bg-ink-950 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

// Button loading
<button disabled={saving}>
  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
  {saving ? "Saving..." : "Save"}
</button>
```

---

## RULE 18 — SECURITY BASICS

Even without auth, maintain these practices:
- Token validation: always verify `recipient.documentId === params.docId` (prevents token-swapping)
- Field ownership: verify `field.recipientId === recipient.id` before accepting field values
- Status guards: check document/recipient status before every mutation
- File serving: PDFs are public (in `/public/uploads/`) — do not put sensitive files outside this directory without protection
