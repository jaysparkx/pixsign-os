# FRONTEND.md
## eSign MVP — Frontend Reference

All frontend code lives in `src/app/` as Next.js App Router pages.  
Client components use `"use client"` directive. Server components do not.

---

## DESIGN SYSTEM

### Colors (Tailwind custom palette)
```typescript
// tailwind.config.ts
colors: {
  ink: {
    50: "#f0f0f5",   // near-white
    100: "#e0e0eb",
    200: "#c1c1d7",
    300: "#9292b8",
    400: "#6b6b96",
    500: "#4a4a7a",
    600: "#383866",
    700: "#2a2a52",
    800: "#1e1e40",  // card backgrounds
    900: "#14142e",  // container backgrounds
    950: "#0a0a1a",  // page background (darkest)
  },
  brand: {
    400: "#ff5590",
    500: "#ff1a6b",  // primary CTA
    600: "#e60050",
    900: "#2a0015",  // danger tint backgrounds
  },
  ok: {
    300: "#5de0a8",
    400: "#3cc287",
    500: "#18a867",  // success
    700: "#096e41",  // dark success
    950: "#030f07",  // success tint bg
  }
}
```

### Typography
- Body: `system-ui, sans-serif` (browser default)
- Monospace: for code, IPs, hashes
- Heading weight: `font-bold` or `font-black`
- No external fonts required

### Common UI patterns
```typescript
// Page background
<div className="min-h-screen bg-ink-950">

// Sticky header
<header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur-sm sticky top-0 z-40">

// Card
<div className="bg-ink-900 border border-ink-800 rounded-xl p-5">

// Primary button
<button className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold transition-all">

// Ghost button  
<button className="px-4 py-2.5 bg-ink-800 hover:bg-ink-700 text-ink-300 rounded-lg transition-colors">

// Input
<input className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-brand-500" />

// Loading spinner
<div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />

// Small spinner (button)
<div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
```

### Status colors
```typescript
const STATUS_COLOR: Record<string, string> = {
  DRAFT:            "text-ink-400",
  SENT:             "text-blue-400",
  PARTIALLY_SIGNED: "text-amber-400",
  COMPLETED:        "text-ok-400",
  DECLINED:         "text-brand-400",
  EXPIRED:          "text-ink-400",
  VOIDED:           "text-ink-400",
}

const RECIPIENT_STATUS_COLOR: Record<string, string> = {
  PENDING:  "text-ink-400",
  SENT:     "text-blue-400",
  VIEWED:   "text-amber-400",
  SIGNED:   "text-ok-400",
  DECLINED: "text-brand-400",
}
```

### Signer color palette (for field color-coding)
```typescript
const SIGNER_COLORS = ["#ff1a6b", "#18a867", "#6464ff", "#f97316", "#38bdf8"]
// Assign by index: SIGNER_COLORS[signerIndex % SIGNER_COLORS.length]
```

### Field type styles
```typescript
const FIELD_TYPES = [
  { type: "SIGNATURE", label: "Signature", color: "#ff1a6b", defaultW: 180, defaultH: 56 },
  { type: "INITIALS",  label: "Initials",  color: "#f97316", defaultW: 80,  defaultH: 40 },
  { type: "DATE",      label: "Date",      color: "#60a5fa", defaultW: 130, defaultH: 36 },
  { type: "TEXT",      label: "Text",      color: "#a78bfa", defaultW: 180, defaultH: 36 },
  { type: "CHECKBOX",  label: "Checkbox",  color: "#34d399", defaultW: 24,  defaultH: 24 },
  { type: "NAME",      label: "Name",      color: "#fbbf24", defaultW: 150, defaultH: 36 },
  { type: "EMAIL",     label: "Email",     color: "#38bdf8", defaultW: 180, defaultH: 36 },
]
```

---

## PAGE: DASHBOARD — `src/app/page.tsx`

**Type:** `"use client"`  
**Route:** `/`

### Responsibilities
- Display list of all documents
- Show stats: Total, Completed, Pending, Drafts
- Drag-and-drop or click-to-upload PDF
- Click document → navigate to `/documents/:id`

### State
```typescript
const [docs, setDocs] = useState<Document[]>([])
const [loading, setLoading] = useState(true)
const [uploading, setUploading] = useState(false)
const [dragOver, setDragOver] = useState(false)
```

### Data fetching
```typescript
// On mount
const docs = await fetch("/api/documents").then(r => r.json())
```

### Upload handler
```typescript
async function upload(file: File) {
  if (file.type !== "application/pdf") { toast.error("PDF only"); return }
  const fd = new FormData()
  fd.append("file", file)
  fd.append("title", file.name.replace(".pdf", ""))
  const res = await fetch("/api/documents/upload", { method: "POST", body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  router.push(`/documents/${data.id}/prepare`)
}
```

### Layout
```
Header:
  - Logo (left)
  - "New Document" button (label wrapping hidden file input)

Stats row:
  - 4 cards: Total · Completed · Pending · Drafts

If no docs → drop zone (click or drag PDF)
If docs exist → list of document cards
  - Each card: icon · title · status badge · signer progress · signer avatars · chevron
  - Click → /documents/:id
```

### Document card anatomy
```
[icon] Title                    ● Status
       N/M signed · Feb 25      [A] [B] [C] >
```

---

## PAGE: DOCUMENT DETAIL — `src/app/documents/[id]/page.tsx`

**Type:** `"use client"`  
**Route:** `/documents/:id`

### Responsibilities
- Show document status + metadata
- Show recipient progress bars + signing status
- For DRAFT: show checklist + send form
- For SENT/PARTIALLY_SIGNED: show signing links, analytics button
- For COMPLETED: show download button
- Void document
- Navigate to editor

### State
```typescript
const [doc, setDoc] = useState<Document | null>(null)
const [sending, setSending] = useState(false)
const [senderName, setSenderName] = useState("Document Sender")
const [voidModal, setVoidModal] = useState(false)
const [voidReason, setVoidReason] = useState("")
```

### Key interactions

**Send flow:**
```typescript
async function send() {
  const res = await fetch(`/api/documents/${id}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderName })
  })
  // on success → reload doc
}
```

**Copy signing link:**
```typescript
function copyLink(token: string) {
  navigator.clipboard.writeText(`${window.location.origin}/sign/${id}/${token}`)
  toast.success("Link copied!")
}
```

**Void:**
```typescript
async function voidDoc() {
  await fetch(`/api/documents/${id}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: voidReason })
  })
}
```

### Layout (2 columns)

```
Left column (2/3):
  - Signing progress card (if recipients exist):
    - Progress bar: signed/total
    - Recipient list: avatar · name · email · status · role · [copy link icon]
  - Draft action card (if DRAFT):
    - Steps: "Prepare fields" ✓/→ and "Recipients" ✓/→
    - Sender name input
    - "Send for Signature" button

Right column (1/3):
  - Document info card: status, created, completed, expires, field count
  - "Open Editor" card (if DRAFT)
```

---

## PAGE: FIELD EDITOR — `src/app/documents/[id]/prepare/page.tsx`

**Type:** `"use client"`  
**Route:** `/documents/:id/prepare`

This is the most complex page. Read carefully.

### Responsibilities
- Render PDF pages using PDF.js
- Allow drag-and-drop placement of fields onto PDF
- Manage recipient list
- Assign fields to recipients
- Save fields via `PUT /api/documents/:id/fields`

### State
```typescript
const [doc, setDoc] = useState<Document | null>(null)
const [fields, setFields] = useState<Field[]>([])
const [recipients, setRecipients] = useState<Recipient[]>([])
const [page, setPage] = useState(1)
const [totalPages, setTotalPages] = useState(1)
const [pdfImages, setPdfImages] = useState<string[]>([])  // one data URL per page
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [scale, setScale] = useState(1)                     // display scale factor
const [pdfW, setPdfW] = useState(612)                     // natural PDF width
const [pdfH, setPdfH] = useState(792)                     // natural PDF height
const [selectedField, setSelectedField] = useState<string | null>(null)
const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null)
const [dragging, setDragging] = useState<string | null>(null)
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
const [tab, setTab] = useState<"fields" | "recipients">("fields")
```

### PDF rendering with PDF.js

```typescript
// Must load pdfjs dynamically (it's browser-only)
async function renderPdf(pdfPath: string) {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

  const pdf = await pdfjs.getDocument(pdfPath).promise
  setTotalPages(pdf.numPages)

  const images: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 2 })  // 2x for retina

    if (n === 1) {
      // Store natural dimensions (at scale=1)
      setPdfW(viewport.width / 2)
      setPdfH(viewport.height / 2)
    }

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise
    images.push(canvas.toDataURL("image/jpeg", 0.9))
  }
  setPdfImages(images)
}
```

### Scale calculation
```typescript
const containerRef = useRef<HTMLDivElement>(null)

// Keep scale in sync with container width
useEffect(() => {
  if (!containerRef.current) return
  const obs = new ResizeObserver(() => {
    const containerWidth = containerRef.current!.clientWidth - 32  // padding
    setScale(containerWidth / pdfW)
  })
  obs.observe(containerRef.current)
  setScale((containerRef.current.clientWidth - 32) / pdfW)
  return () => obs.disconnect()
}, [pdfW])
```

### Adding a field
```typescript
function addField(type: string) {
  const ft = FIELD_TYPES.find(f => f.type === type)!
  const newField: Field = {
    id: `tmp-${Date.now()}`,         // temp ID until saved
    page,
    x: 60,                           // default position (natural units)
    y: 60,
    width: ft.defaultW,
    height: ft.defaultH,
    type,
    recipientId: selectedRecipient,   // auto-assign to current recipient
    required: true,
    label: null,
  }
  setFields(prev => [...prev, newField])
}
```

### Drag behavior
```typescript
function onMouseDown(e: React.MouseEvent, fieldId: string) {
  e.preventDefault()
  e.stopPropagation()
  setSelectedField(fieldId)
  setDragging(fieldId)
  // Calculate offset from field top-left to cursor
  const el = (e.target as HTMLElement).closest("[data-field]") as HTMLElement
  const containerRect = containerRef.current!.getBoundingClientRect()
  const fieldRect = el.getBoundingClientRect()
  setDragOffset({ x: e.clientX - fieldRect.left, y: e.clientY - fieldRect.top })
}

function onMouseMove(e: React.MouseEvent) {
  if (!dragging) return
  const containerRect = containerRef.current!.getBoundingClientRect()
  const field = fields.find(f => f.id === dragging)!
  const newX = Math.max(0, Math.min(
    (e.clientX - containerRect.left - dragOffset.x) / scale,  // ÷ scale → natural units
    pdfW - field.width
  ))
  const newY = Math.max(0, Math.min(
    (e.clientY - containerRect.top - dragOffset.y) / scale,
    pdfH - field.height
  ))
  setFields(prev => prev.map(f => f.id === dragging ? { ...f, x: newX, y: newY } : f))
}

// Attach to container div:
// onMouseMove={onMouseMove}
// onMouseUp={() => setDragging(null)}
// onMouseLeave={() => setDragging(null)}
```

### Field rendering on canvas
```typescript
// Only render fields for current page
const pageFields = fields.filter(f => f.page === page)

// Each field:
<div
  data-field
  className="absolute cursor-move"
  style={{
    left: field.x * scale,
    top: field.y * scale,
    width: field.width * scale,
    height: field.height * scale,
    background: `${recipientColor}15`,     // 15 = 8% opacity
    border: `${isSelected ? "2px solid" : "1.5px dashed"} ${recipientColor}`,
    borderRadius: 3,
    outline: isSelected ? `3px solid ${recipientColor}30` : "none",
    outlineOffset: 2,
  }}
  onMouseDown={e => onMouseDown(e, field.id)}
  onClick={e => { e.stopPropagation(); setSelectedField(field.id) }}
>
  {/* Field type label tag */}
  <div
    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-white whitespace-nowrap"
    style={{ background: recipientColor, fontSize: 10 }}
  >
    {fieldType.label}{field.required ? "*" : ""}
  </div>

  {/* Delete button on selected */}
  {isSelected && (
    <button
      className="absolute -top-4 -right-4 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center text-white z-10"
      onMouseDown={e => { e.stopPropagation(); deleteField(field.id) }}
    >
      <X size={8} />
    </button>
  )}
</div>
```

### Save
```typescript
async function save() {
  setSaving(true)
  // Fields stored at natural PDF scale — send as-is
  await fetch(`/api/documents/${id}/fields`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  })
  router.push(`/documents/${id}`)
}
```

### Sidebar tabs

**Fields tab:**
- List of FIELD_TYPES with colored dot + label → click to addField()
- If a field is selected: show "Selected Field" properties panel:
  - Dropdown to assign/change recipient
  - Required toggle checkbox
  - Delete button

**Recipients tab:**
- List of recipients with colored avatar, name, email, field count, role
- Click recipient → sets as `selectedRecipient` (new fields auto-assigned to them)
- X button to remove recipient
- "Add Recipient" expand form: name input, email input, role select (SIGNER/CC)

### Layout
```
Toolbar (fixed height):
  ← back · Document title · Page navigation · Save button

Sidebar (fixed width, 256px):
  Fields | Recipients tabs
  Tab content (scrollable)

PDF Canvas (flex-grow, scrollable):
  - Positioned container at exactly pdfW*scale × pdfH*scale
  - PDF page image (absolute, full size, pointer-events: none)
  - Field overlays (absolute, draggable)
```

---

## PAGE: ANALYTICS — `src/app/documents/[id]/analytics/page.tsx`

**Type:** `"use client"`  
**Route:** `/documents/:id/analytics`

### Data
```typescript
// Fetch on mount
const data = await fetch(`/api/documents/${id}/analytics`).then(r => r.json())
// data shape: see BACKEND.md GET /analytics
```

### Layout
```
Header: ← back · doc title · "Analytics" subtitle

Stats row (4 cards):
  Completion % · Fields done · Total events · Status

Two columns:
  Left: Recipients card
    - Each recipient: status dot · name · email · role
    - Sent date · Viewed date · Signed date · IP address

  Right: Activity Timeline
    - Vertical line connector
    - Each event: dot · event label (colored) · time · recipient + IP
```

### Event label map
```typescript
const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  DOCUMENT_CREATED:   { label: "Document created",      color: "text-ink-400" },
  DOCUMENT_SENT:      { label: "Sent for signatures",   color: "text-blue-400" },
  DOCUMENT_COMPLETED: { label: "All parties signed",    color: "text-ok-400" },
  DOCUMENT_VOIDED:    { label: "Document voided",       color: "text-brand-400" },
  EMAIL_SENT:         { label: "Signing email sent",    color: "text-blue-400" },
  RECIPIENT_VIEWED:   { label: "Document viewed",       color: "text-amber-400" },
  RECIPIENT_SIGNED:   { label: "Signed",                color: "text-ok-400" },
  RECIPIENT_DECLINED: { label: "Declined",              color: "text-brand-400" },
  FIELD_SIGNED:       { label: "Field completed",       color: "text-ok-300" },
  DOWNLOAD:           { label: "Document downloaded",   color: "text-ink-300" },
}
```

---

## PAGE: SIGNING EXPERIENCE — `src/app/sign/[docId]/[token]/page.tsx`

**Type:** `"use client"`  
**Route:** `/sign/:docId/:token`

This is the recipient-facing signing page. No header navigation. Mobile-first.

### States (mutually exclusive screen views)
```
loading    → spinner
error      → error message + icon
alreadySigned → "Already Signed" message
done       → success celebration
main       → PDF + fields + signature modal
```

### State
```typescript
const [session, setSession] = useState<SigningSession | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [done, setDone] = useState(false)
const [alreadySigned, setAlreadySigned] = useState(false)
const [page, setPage] = useState(1)
const [totalPages, setTotalPages] = useState(1)
const [pdfImages, setPdfImages] = useState<string[]>([])
const [pdfW, setPdfW] = useState(612)
const [pdfH, setPdfH] = useState(792)
const [scale, setScale] = useState(1)

// Values keyed by field ID
const [values, setValues] = useState<Record<string, { value?: string; sigDataUrl?: string }>>({})

// Signature modal
const [activeField, setActiveField] = useState<Field | null>(null)  // null = modal closed
const [mode, setMode] = useState<"DRAW" | "TYPE" | "UPLOAD">("DRAW")
const [typedSig, setTypedSig] = useState("")
const [selectedFont, setSelectedFont] = useState(SIG_FONTS[0])
const [uploadedSig, setUploadedSig] = useState<string | null>(null)

// Consent modal
const [showConsent, setShowConsent] = useState(false)
const [submitting, setSubmitting] = useState(false)

// Canvas refs
const canvasRef = useRef<HTMLCanvasElement>(null)
const containerRef = useRef<HTMLDivElement>(null)
const isDrawing = useRef(false)
```

### Session load
```typescript
useEffect(() => {
  async function load() {
    const data = await fetch(`/api/sign/${docId}/${token}`).then(r => r.json())

    if (data.error) { setError(data.error); return }
    if (data.completed) { setDone(true); return }
    if (data.alreadySigned) { setAlreadySigned(true); return }
    if (data.declined) { setError("You declined to sign this document."); return }

    setSession(data)

    // Pre-fill auto fields
    const init: typeof values = {}
    for (const f of data.fields) {
      if (f.type === "DATE")  init[f.id] = { value: new Date().toISOString().split("T")[0] }
      if (f.type === "NAME")  init[f.id] = { value: data.recipient.name }
      if (f.type === "EMAIL") init[f.id] = { value: data.recipient.email }
    }
    setValues(init)

    // Render PDF
    await renderPdf(data.document.pdfUrl)
  }
  load().catch(() => setError("Failed to load document")).finally(() => setLoading(false))
}, [])
```

### Field rendering on signing page
```typescript
// For each field on current page:
if (field.type === "SIGNATURE" || field.type === "INITIALS") {
  if (values[field.id]?.sigDataUrl) {
    // Show embedded signature image
    <img src={values[field.id].sigDataUrl} className="w-full h-full object-contain" />
  } else {
    // Show clickable placeholder
    <div
      onClick={() => setActiveField(field)}
      className="w-full h-full flex items-center justify-center rounded cursor-pointer"
      style={{ background: "rgba(255,26,107,0.08)", border: "2px dashed #ff1a6b" }}
    >
      <Pen size={16} className="text-brand-500" />
      <span className="text-xs text-brand-500 ml-1">Sign</span>
    </div>
  }
}

if (field.type === "CHECKBOX") {
  <div
    onClick={() => setValues(prev => ({
      ...prev,
      [field.id]: { value: prev[field.id]?.value === "true" ? "false" : "true" }
    }))}
    className="w-full h-full flex items-center justify-center rounded cursor-pointer"
    style={{
      background: values[field.id]?.value === "true" ? "rgba(24,168,103,0.2)" : "rgba(24,168,103,0.05)",
      border: `2px solid ${values[field.id]?.value === "true" ? "#18a867" : "rgba(24,168,103,0.4)"}`
    }}
  >
    {values[field.id]?.value === "true" && <CheckCircle2 size={16} className="text-ok-400" />}
  </div>
}

// TEXT, DATE, NAME, EMAIL — editable input
<input
  type={field.type === "EMAIL" ? "email" : "text"}
  value={values[field.id]?.value || ""}
  onChange={e => setValues(prev => ({ ...prev, [field.id]: { value: e.target.value } }))}
  placeholder={field.label || field.type}
  className="w-full h-full px-2 bg-transparent text-ink-100 focus:outline-none rounded"
  style={{
    fontSize: Math.min(13, field.height * scale * 0.4),
    background: "rgba(160,100,255,0.08)",
    border: "1.5px solid rgba(160,100,255,0.5)"
  }}
/>
```

### Signature modal — 3 tabs

**DRAW tab:**
```typescript
// Canvas drawing
<canvas
  ref={canvasRef}
  width={420}
  height={130}
  className="w-full border border-ink-700 rounded-lg bg-white cursor-crosshair"
  onMouseDown={(e) => {
    const ctx = canvasRef.current!.getContext("2d")!
    const r = canvasRef.current!.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top)
    isDrawing.current = true
  }}
  onMouseMove={(e) => {
    if (!isDrawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const r = canvasRef.current!.getBoundingClientRect()
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top)
    ctx.strokeStyle = "#1a1a3a"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.stroke()
  }}
  onMouseUp={() => { isDrawing.current = false }}
  onMouseLeave={() => { isDrawing.current = false }}
/>
```

**TYPE tab:**
```typescript
const SIG_FONTS = [
  { name: "Dancing Script", css: "'Dancing Script', cursive" },
  { name: "Caveat",          css: "'Caveat', cursive" },
  { name: "Pacifico",        css: "'Pacifico', cursive" },
]

// Import at top of component
<style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Caveat:wght@600&family=Pacifico&display=swap');`}</style>

// Large input showing text in chosen font
<input
  value={typedSig}
  onChange={e => setTypedSig(e.target.value)}
  placeholder={session.recipient.name}
  style={{ fontFamily: selectedFont.css, fontSize: 28 }}
  className="w-full px-4 py-3 bg-ink-800 border border-ink-700 rounded-lg text-ink-100"
/>

// Font picker
{SIG_FONTS.map(font => (
  <button
    onClick={() => setSelectedFont(font)}
    style={{ fontFamily: font.css }}
    className={selectedFont.name === font.name ? "border-brand-500" : "border-ink-700"}
  >
    {typedSig || session.recipient.name}
  </button>
))}
```

**UPLOAD tab:**
```typescript
<label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-ink-700 rounded-lg cursor-pointer">
  <Upload size={22} className="text-ink-500 mb-2" />
  <span className="text-sm text-ink-400">Upload signature image</span>
  <input
    type="file" accept="image/*" className="hidden"
    onChange={e => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => setUploadedSig(ev.target?.result as string)
      reader.readAsDataURL(file)
    }}
  />
</label>
```

### Apply signature
```typescript
function applySignature() {
  if (!activeField) return
  let sigDataUrl: string

  if (mode === "DRAW") {
    const canvas = canvasRef.current!
    // Verify something was drawn
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data
    if (!data.some(v => v !== 0)) { toast.error("Please draw your signature"); return }
    sigDataUrl = canvas.toDataURL("image/png")
  }
  else if (mode === "TYPE") {
    // Render text to canvas
    const canvas = document.createElement("canvas")
    canvas.width = 400; canvas.height = 120
    const ctx = canvas.getContext("2d")!
    ctx.font = `64px ${selectedFont.css}`
    ctx.fillStyle = "#1a1a3a"
    ctx.textBaseline = "middle"
    ctx.fillText(typedSig || session.recipient.name, 20, 60)
    sigDataUrl = canvas.toDataURL("image/png")
  }
  else {
    if (!uploadedSig) { toast.error("Upload an image"); return }
    sigDataUrl = uploadedSig
  }

  setValues(prev => ({ ...prev, [activeField.id]: { sigDataUrl } }))
  setActiveField(null)
  // Reset modal state
  canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  setTypedSig("")
  setUploadedSig(null)
}
```

### Submit flow
```typescript
async function handleSubmit() {
  // Check all required fields are filled
  const required = session!.fields.filter(f => f.required)
  const missing = required.filter(f => !values[f.id])
  if (missing.length) {
    toast.error(`Complete all required fields: ${missing.map(f => f.type).join(", ")}`)
    return
  }
  setShowConsent(true)  // Show consent modal first
}

async function doSubmit() {
  setShowConsent(false)
  setSubmitting(true)
  try {
    const payload = session!.fields.map(f => ({ id: f.id, ...values[f.id] }))
    const res = await fetch(`/api/sign/${docId}/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: payload, consent: true }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setDone(true)
  } catch (e: any) {
    toast.error(e.message || "Submission failed")
  } finally {
    setSubmitting(false)
  }
}
```

### Consent modal content
```
Electronic Signature Consent

"By clicking I Agree & Sign, you confirm:"
✓ You've reviewed the document
✓ Your electronic signature is legally binding
✓ Your signature, IP address, and timestamp will be recorded

[Review Again] [I Agree & Sign]
```

### Layout (mobile-first)
```
Header (sticky):
  Logo · Document title · "Signing as Name" · Progress indicator

Optional message bar (if doc.message exists)

Page navigation (if totalPages > 1):
  ← · Page N of M · →

PDF canvas area (flex-grow, scrollable):
  - PDF image
  - Field overlays (interactive)

Footer (sticky):
  [Decline] ··· Progress count ··· [Complete Signing →]

Modals (AnimatePresence):
  - Signature modal (slides up from bottom on mobile)
  - Consent modal (centered)
```

### Decline flow
```typescript
async function decline() {
  const reason = window.prompt("Reason for declining (optional):")
  if (reason === null) return  // user cancelled prompt
  await fetch(`/api/sign/${docId}/${token}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  })
  setError("You have declined to sign this document.")
}
```

---

## DEPENDENCY NOTES

### PDF.js (pdfjs-dist)
```typescript
// Always import dynamically (browser-only)
const pdfjs = await import("pdfjs-dist")
pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
```

Never import PDF.js at the top of a file. It will break SSR.

### Framer Motion
```typescript
// For modals and cards
import { motion, AnimatePresence } from "framer-motion"

// Card entrance
<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} />

// Modal
<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} />

// Slide up (mobile modal)
<motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} />

// Always wrap with AnimatePresence for exit animations
```

### react-hot-toast
```typescript
import toast from "react-hot-toast"
toast.success("Saved!")
toast.error("Something went wrong")
// In layout.tsx:
<Toaster
  position="top-right"
  toastOptions={{
    style: { background: "#14142e", color: "#e0e0eb", border: "1px solid #2a2a52", borderRadius: "10px" },
    success: { iconTheme: { primary: "#18a867", secondary: "#0a0a1a" } },
    error: { iconTheme: { primary: "#ff1a6b", secondary: "#0a0a1a" } },
  }}
/>
```

### Lucide React
```typescript
import { ArrowLeft, Save, Plus, X, CheckCircle2, ... } from "lucide-react"
// Always specify size prop: <ArrowLeft size={20} />
```
