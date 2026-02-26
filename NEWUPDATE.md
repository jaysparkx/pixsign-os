# Pixsign — Next Update: 8 Core Features

> Deep implementation guide for Next.js full-stack (App Router, Prisma, PostgreSQL)

---

## 1. One-Link Everything (#2)

### What It Is
Every document gets a unique cryptographic link (`/d/[token]`) that requires zero authentication from the signer. Recipients can view, sign, and comment on the document — all on a single page, no account needed.

### Why It Matters
Eliminates the #1 friction point in e-signatures: forcing signers to create accounts. One link = done. Conversion rates skyrocket when there's no login wall.

### Technical Architecture

**Flow:**
1. Owner creates document → API generates a `nanoid(21)` token → stores in DB
2. Owner shares link: `https://pixsign.app/d/abc123xyz`
3. Recipient opens link → public route (no auth middleware) → loads doc + signing UI
4. Recipient signs → signature stored against the token + signer email (collected inline)

**Route Structure:**
```
app/d/[token]/page.tsx          → Public document viewer/signer
app/api/d/[token]/route.ts      → GET doc data, POST signature
app/api/d/[token]/comments/route.ts → GET/POST comments
app/api/documents/route.ts      → POST create doc (authenticated)
```

**No-Auth Strategy:**
- `middleware.ts` excludes `/d/*` from auth checks
- Rate-limit by IP on public routes (upstash/ratelimit)
- Optional: require email verification via OTP before signing (configurable per doc)

### Database Schema

```prisma
model Document {
  id          String   @id @default(cuid())
  token       String   @unique @default(nanoid(21))
  title       String
  fileUrl     String   // S3/R2 URL to PDF
  fileHash    String   // SHA-256 for integrity
  status      DocStatus @default(DRAFT)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  signatures  Signature[]
  comments    Comment[]
  versions    DocumentVersion[]
  fields      SigningField[]
}

enum DocStatus {
  DRAFT
  SENT
  VIEWED
  SIGNED
  EXPIRED
  VOIDED
}

model Signature {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  signerEmail String
  signerName  String
  signerIp    String
  signatureData String  // base64 drawn signature or typed
  signedAt    DateTime @default(now())
  certificate String?  // signing certificate JSON
}

model SigningField {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  type        FieldType // SIGNATURE, INITIALS, DATE, TEXT, CHECKBOX
  page        Int
  x           Float
  y           Float
  width       Float
  height      Float
  assignedTo  String?  // email of intended signer
  value       String?
  required    Boolean  @default(true)
}

enum FieldType {
  SIGNATURE
  INITIALS
  DATE
  TEXT
  CHECKBOX
}

model Comment {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  authorEmail String
  authorName  String
  content     String
  page        Int?
  x           Float?
  y           Float?
  parentId    String?
  parent      Comment? @relation("CommentThread", fields: [parentId], references: [id])
  replies     Comment[] @relation("CommentThread")
  createdAt   DateTime @default(now())
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/documents` | Yes | Create document, upload PDF, get token |
| GET | `/api/d/[token]` | No | Fetch doc metadata + PDF URL + fields |
| POST | `/api/d/[token]/sign` | No | Submit signature (collects email inline) |
| GET | `/api/d/[token]/comments` | No | List comments |
| POST | `/api/d/[token]/comments` | No | Add comment |
| POST | `/api/d/[token]/verify` | No | Verify signer email via OTP |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `DocumentViewer` | PDF renderer (react-pdf) with page navigation |
| `SigningField` | Draggable/placeable field overlay on PDF pages |
| `SignaturePad` | Canvas-based signature drawing (react-signature-canvas) |
| `CommentLayer` | Pin comments on specific PDF coordinates |
| `CommentThread` | Threaded comment sidebar |
| `SignerIdentity` | Inline email collection + optional OTP |
| `DocumentStatus` | Status badge (draft/sent/viewed/signed) |

### Priority & Complexity
- **Priority:** P0 — This IS the product. Ship first.
- **Complexity:** Medium (2-3 weeks)
- **Dependencies:** PDF rendering, file storage (S3/R2), email service

---

## 2. Deal Rooms (#5)

### What It Is
A branded, shareable link containing multiple documents in one place — like a virtual deal room. Tracks who viewed what, how long they spent on each page, and which docs they downloaded. Think DocSend but built into your signing flow.

### Why It Matters
Sales teams and lawyers send multiple docs (proposals, contracts, NDAs). A deal room gives them one link instead of 5 attachments, plus intelligence on buyer engagement. "They spent 8 minutes on the pricing page" = ready to close.

### Technical Architecture

**Flow:**
1. Owner creates a Room → adds multiple documents → gets branded link `/r/[slug]`
2. Visitor opens link → optionally enters email (gate) → sees document list
3. Visitor views docs → every page view, scroll, and time event is tracked
4. Owner sees real-time analytics dashboard

**Route Structure:**
```
app/r/[slug]/page.tsx               → Room landing (doc list, branding)
app/r/[slug]/[docId]/page.tsx       → Individual doc viewer within room
app/api/rooms/route.ts              → CRUD rooms
app/api/rooms/[roomId]/docs/route.ts → Add/remove docs from room
app/api/rooms/[roomId]/analytics/route.ts → Analytics dashboard data
app/api/track/route.ts              → Beacon endpoint for view events
```

**Tracking Strategy:**
- `IntersectionObserver` on each PDF page — fires when page is ≥50% visible
- Timer starts on intersection, stops on un-intersection
- Events batched every 5s and sent via `navigator.sendBeacon()` (survives tab close)
- Fallback: `fetch` with `keepalive: true`
- Track: `{ visitorId, roomId, docId, page, enterTime, exitTime, scrollDepth }`

### Database Schema

```prisma
model Room {
  id          String   @id @default(cuid())
  slug        String   @unique @default(nanoid(10))
  name        String
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  branding    Json?    // { logo, primaryColor, companyName }
  requireEmail Boolean @default(true)
  password    String?  // optional room password
  allowDownload Boolean @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  documents   RoomDocument[]
  visitors    RoomVisitor[]
}

model RoomDocument {
  id          String   @id @default(cuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id])
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  order       Int      @default(0)
  createdAt   DateTime @default(now())
}

model RoomVisitor {
  id          String   @id @default(cuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id])
  email       String?
  ipAddress   String
  userAgent   String
  firstVisit  DateTime @default(now())
  lastVisit   DateTime @default(now())

  events      ViewEvent[]
}

model ViewEvent {
  id          String   @id @default(cuid())
  visitorId   String
  visitor     RoomVisitor @relation(fields: [visitorId], references: [id])
  documentId  String
  page        Int
  enterTime   DateTime
  exitTime    DateTime?
  durationMs  Int?
  scrollDepth Float?   // 0.0 to 1.0
  createdAt   DateTime @default(now())

  @@index([visitorId, documentId])
  @@index([documentId, page])
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/rooms` | Yes | Create room |
| GET | `/api/rooms/[roomId]` | Yes | Get room details |
| PUT | `/api/rooms/[roomId]` | Yes | Update room settings/branding |
| POST | `/api/rooms/[roomId]/docs` | Yes | Add document to room |
| DELETE | `/api/rooms/[roomId]/docs/[docId]` | Yes | Remove doc from room |
| GET | `/api/rooms/[roomId]/analytics` | Yes | Aggregated analytics |
| GET | `/api/rooms/[roomId]/analytics/visitors` | Yes | Per-visitor breakdown |
| POST | `/api/track` | No | Beacon endpoint for view events |
| GET | `/api/r/[slug]` | No | Public room data |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `RoomBuilder` | Create/edit room, drag-reorder docs, set branding |
| `RoomLanding` | Public room page with doc list + branding |
| `EmailGate` | Modal collecting visitor email before viewing |
| `RoomAnalyticsDashboard` | Charts: total views, time per doc, visitor list |
| `VisitorTimeline` | Per-visitor activity timeline |
| `PageHeatmap` | Visual heatmap of time spent per page |
| `BrandingEditor` | Upload logo, set colors for room |

### Priority & Complexity
- **Priority:** P1 — Major differentiator, builds on One-Link foundation
- **Complexity:** High (3-4 weeks)
- **Dependencies:** One-Link Everything (#2), file storage, analytics infrastructure

---

## 3. Free Forever 3 Docs/Month (#6)

### What It Is
A freemium model where every user gets 3 document signings per month, forever — no trial period, no credit card required. After 3, they see upgrade prompts but existing signed docs remain accessible.

### Why It Matters
Removes all adoption friction. Users try the product with real documents, build habits, then upgrade when they hit limits. "Free forever" messaging converts better than "14-day trial" because there's no countdown anxiety.

### Technical Architecture

**Flow:**
1. User signs up → `usageCount` starts at 0 for current month
2. User creates/sends doc for signing → increment usage
3. At doc 3 → show "1 left this month" banner
4. At doc 4 → soft block with upgrade modal (can still view/download existing)
5. 1st of each month → usage resets (cron job or lazy check)

**Usage Counting Logic (lazy reset):**
```typescript
// No cron needed — check on read
function getMonthlyUsage(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return prisma.document.count({
    where: {
      ownerId: userId,
      status: { not: 'DRAFT' }, // only count sent/signed docs
      createdAt: { gte: startOfMonth }
    }
  });
}
```

**Route Structure:**
```
app/api/usage/route.ts              → GET current usage stats
app/api/billing/route.ts            → GET/POST subscription management
app/api/billing/checkout/route.ts   → POST create Stripe checkout session
app/api/billing/webhook/route.ts    → POST Stripe webhook handler
```

### Database Schema

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  plan          Plan     @default(FREE)
  stripeCustomerId String? @unique
  stripeSubId   String?  @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  documents     Document[]
  rooms         Room[]
}

enum Plan {
  FREE        // 3 docs/month
  PRO         // 50 docs/month
  BUSINESS    // unlimited
  ENTERPRISE  // custom
}

model PlanLimit {
  id          String @id @default(cuid())
  plan        Plan   @unique
  docsPerMonth Int   // FREE=3, PRO=50, BUSINESS=-1
  rooms       Int    // FREE=0, PRO=5, BUSINESS=-1
  analytics   Boolean // FREE=false, PRO=true
  apiAccess   Boolean // FREE=false, PRO=true
  customBranding Boolean // FREE=false
}

// Optional: explicit tracking for audit trail
model UsageRecord {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // "document_sent", "room_created"
  resourceId  String?
  month       String   // "2026-02" for easy grouping
  createdAt   DateTime @default(now())

  @@index([userId, month])
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/usage` | Yes | Current month usage + limits |
| GET | `/api/billing` | Yes | Subscription status |
| POST | `/api/billing/checkout` | Yes | Create Stripe checkout |
| POST | `/api/billing/portal` | Yes | Stripe customer portal URL |
| POST | `/api/billing/webhook` | No | Stripe webhook (verify signature) |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `UsageBanner` | Persistent banner: "2 of 3 docs used this month" |
| `UpgradeModal` | Triggered at limit — shows plan comparison |
| `PricingTable` | Plan comparison with feature matrix |
| `UsageMeter` | Visual progress bar of monthly usage |
| `BillingSettings` | Manage subscription, view invoices |

### Priority & Complexity
- **Priority:** P0 — Core business model, implement alongside auth
- **Complexity:** Low-Medium (1-2 weeks)
- **Dependencies:** Auth system, Stripe integration (basic)

---

## 4. Version Negotiation (#11)

### What It Is
An inline commenting and suggestion system layered on top of documents — like Google Docs' suggestion mode but for PDFs/contracts. Users can highlight text, leave threaded comments, suggest edits, and accept/reject changes, all in real-time.

### Why It Matters
Contract negotiation typically involves emailing Word docs back and forth. Version Negotiation keeps everything in one place with a clear audit trail. Both parties see changes live, reducing turnaround from days to minutes.

### Technical Architecture

**Flow:**
1. Owner shares doc → recipient opens → clicks "Suggest Edit" mode
2. Recipient highlights text → types suggestion → submits
3. Owner gets notified → sees suggestion inline with accept/reject buttons
4. Accepted suggestions create a new version automatically
5. All changes are real-time via WebSocket (Pusher/Ably or self-hosted ws)

**Real-Time Strategy:**
- Use Pusher Channels (or Ably) for real-time — simpler than self-hosted WebSocket at early stage
- Channel per document: `document-{token}`
- Events: `comment:new`, `comment:reply`, `suggestion:new`, `suggestion:accepted`, `suggestion:rejected`
- Fallback: polling every 5s if WebSocket fails

**Route Structure:**
```
app/api/d/[token]/annotations/route.ts     → CRUD annotations
app/api/d/[token]/suggestions/route.ts     → CRUD suggestions
app/api/d/[token]/suggestions/[id]/route.ts → Accept/reject suggestion
app/api/pusher/auth/route.ts               → Pusher channel auth
```

### Database Schema

```prisma
model Annotation {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  authorEmail String
  authorName  String
  type        AnnotationType
  page        Int
  // Position: for highlights, store text range; for pins, store coordinates
  startOffset Int?     // text character offset start
  endOffset   Int?     // text character offset end
  x           Float?
  y           Float?
  content     String   // comment text
  status      AnnotationStatus @default(OPEN)
  parentId    String?
  parent      Annotation? @relation("AnnotationThread", fields: [parentId], references: [id])
  replies     Annotation[] @relation("AnnotationThread")
  resolved    Boolean  @default(false)
  resolvedBy  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum AnnotationType {
  COMMENT      // pin or highlight comment
  SUGGESTION   // proposed text change
}

enum AnnotationStatus {
  OPEN
  ACCEPTED
  REJECTED
  RESOLVED
}

model Suggestion {
  id            String   @id @default(cuid())
  annotationId  String   @unique
  annotation    Annotation @relation(fields: [annotationId], references: [id])
  originalText  String
  suggestedText String
  status        AnnotationStatus @default(OPEN)
  reviewedBy    String?
  reviewedAt    DateTime?
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/d/[token]/annotations` | No | List all annotations for doc |
| POST | `/api/d/[token]/annotations` | No | Create comment or suggestion |
| PUT | `/api/d/[token]/annotations/[id]` | No | Edit annotation |
| DELETE | `/api/d/[token]/annotations/[id]` | No | Delete own annotation |
| POST | `/api/d/[token]/suggestions/[id]/accept` | Token-owner | Accept suggestion |
| POST | `/api/d/[token]/suggestions/[id]/reject` | Token-owner | Reject suggestion |
| POST | `/api/pusher/auth` | No | Authenticate Pusher channel |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `AnnotationLayer` | Transparent overlay on PDF for placing comments/highlights |
| `HighlightRenderer` | Renders highlighted text regions on PDF |
| `CommentSidebar` | Thread view of all annotations, filterable |
| `SuggestionInline` | Shows original → suggested text with accept/reject |
| `SuggestEditToolbar` | Toggle suggest-edit mode, text selection tools |
| `PresenceIndicator` | Shows who's currently viewing (real-time) |
| `NotificationBell` | In-app notifications for new comments/suggestions |

### Priority & Complexity
- **Priority:** P2 — Powerful differentiator but complex
- **Complexity:** High (4-6 weeks)
- **Dependencies:** One-Link Everything, real-time infrastructure (Pusher), PDF text extraction

---

## 5. API-First + Zapier (#12)

### What It Is
Every Pixsign feature is available via a documented REST API from day one. API keys for programmatic access, webhook events for integrations, and a Zapier app so non-developers can automate workflows (e.g., "When contract signed → add row to Google Sheet").

### Why It Matters
API-first means Pixsign can be embedded into any workflow. Developers integrate directly; non-developers use Zapier/Make. This turns Pixsign from a standalone tool into platform infrastructure — massively increases stickiness and TAM.

### Technical Architecture

**API Design Principles:**
- All UI features are thin clients over the same API routes
- Versioned: `/api/v1/...`
- Auth: Bearer token (API key) or session cookie
- Rate limiting: Token bucket per API key (upstash/ratelimit)
- Response format: `{ data, error, meta: { page, total } }`

**Webhook System:**
- Owner registers webhook URLs for specific events
- On event → queue job (BullMQ/Inngest) → POST to webhook URL with retry (3 attempts, exponential backoff)
- Verify delivery via HMAC signature header

**Zapier Integration:**
- Build as a Zapier CLI app
- Triggers: `document.signed`, `document.viewed`, `room.visited`, `comment.added`
- Actions: `create_document`, `send_document`, `create_room`
- Auth: API key

**Route Structure:**
```
app/api/v1/documents/route.ts
app/api/v1/documents/[id]/route.ts
app/api/v1/documents/[id]/send/route.ts
app/api/v1/rooms/route.ts
app/api/v1/rooms/[id]/route.ts
app/api/v1/webhooks/route.ts
app/api/v1/webhooks/[id]/route.ts
app/api/v1/api-keys/route.ts
```

### Database Schema

```prisma
model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String   // "Production", "Staging"
  keyHash     String   @unique // SHA-256 hash of the key (never store raw)
  keyPrefix   String   // First 8 chars for identification: "pk_live_a1b2..."
  scopes      String[] // ["documents:read", "documents:write", "rooms:*"]
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([keyHash])
}

model Webhook {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  url         String
  secret      String   // HMAC signing secret
  events      String[] // ["document.signed", "room.visited"]
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  deliveries  WebhookDelivery[]
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  webhook     Webhook  @relation(fields: [webhookId], references: [id])
  event       String
  payload     Json
  statusCode  Int?
  response    String?
  attempts    Int      @default(0)
  deliveredAt DateTime?
  createdAt   DateTime @default(now())

  @@index([webhookId, createdAt])
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/api-keys` | Session | Generate new API key |
| GET | `/api/v1/api-keys` | Session | List API keys |
| DELETE | `/api/v1/api-keys/[id]` | Session | Revoke key |
| GET | `/api/v1/documents` | API Key | List documents |
| POST | `/api/v1/documents` | API Key | Create document |
| POST | `/api/v1/documents/[id]/send` | API Key | Send for signing |
| GET | `/api/v1/rooms` | API Key | List rooms |
| POST | `/api/v1/rooms` | API Key | Create room |
| POST | `/api/v1/webhooks` | API Key | Register webhook |
| GET | `/api/v1/webhooks` | API Key | List webhooks |
| DELETE | `/api/v1/webhooks/[id]` | API Key | Remove webhook |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `ApiKeyManager` | Generate, list, revoke API keys |
| `ApiKeyDisplay` | One-time display of generated key |
| `WebhookManager` | CRUD webhook endpoints |
| `WebhookDeliveryLog` | View delivery attempts, status, retry |
| `ApiPlayground` | Interactive API explorer (like Stripe's) |
| `ApiDocs` | Auto-generated docs from OpenAPI spec |

### Priority & Complexity
- **Priority:** P1 — Design API-first from day 1 (routes serve both UI and API)
- **Complexity:** Medium (2-3 weeks for core API + keys + webhooks; Zapier app adds 1 week)
- **Dependencies:** All feature APIs must follow consistent patterns

---

## 6. Document Analytics (#13)

### What It Is
Detailed analytics showing exactly how recipients interact with documents — heatmap of time spent per page, total viewing duration, scroll depth, number of visits, and device/location info. Think "Google Analytics for your contracts."

### Why It Matters
Knowing a prospect spent 4 minutes on the pricing page but skipped the terms tells you exactly where to follow up. Analytics turn blind document sending into an informed sales process.

### Technical Architecture

**Tracking (Client-Side):**
```typescript
// On document viewer page
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      startTimer(entry.target.dataset.page);
    } else {
      stopTimer(entry.target.dataset.page);
      queueEvent(entry.target.dataset.page);
    }
  });
}, { threshold: 0.5 });

// Batch send every 5 seconds
const flushEvents = () => {
  if (eventQueue.length === 0) return;
  navigator.sendBeacon('/api/track', JSON.stringify({
    token: docToken,
    visitorId: getOrCreateVisitorId(), // fingerprint or cookie
    events: eventQueue.splice(0)
  }));
};
setInterval(flushEvents, 5000);
window.addEventListener('beforeunload', flushEvents);
```

**Aggregation (Server-Side):**
- Raw events stored in `ViewEvent` table
- Aggregation via SQL queries (or materialized views for performance):
  - Per-page average time = `AVG(durationMs) GROUP BY page`
  - Heatmap data = time per page normalized to max
  - Completion rate = visitors who viewed last page / total visitors

**Route Structure:**
```
app/api/track/route.ts                          → POST beacon events
app/api/documents/[id]/analytics/route.ts        → GET aggregated analytics
app/api/documents/[id]/analytics/visitors/route.ts → GET per-visitor data
app/api/documents/[id]/analytics/heatmap/route.ts  → GET page heatmap data
```

### Database Schema

```prisma
// ViewEvent is shared with Deal Rooms — reuse the same model
model ViewEvent {
  id          String   @id @default(cuid())
  visitorId   String   // cookie-based or RoomVisitor FK
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  page        Int
  durationMs  Int
  scrollDepth Float    // 0.0 to 1.0
  enterTime   DateTime
  exitTime    DateTime
  createdAt   DateTime @default(now())

  @@index([documentId, page])
  @@index([documentId, visitorId])
  @@index([createdAt])
}

model DocumentAnalytics {
  id              String @id @default(cuid())
  documentId      String @unique
  document        Document @relation(fields: [documentId], references: [id])
  totalViews      Int    @default(0)
  uniqueVisitors  Int    @default(0)
  avgDurationMs   Int    @default(0)
  completionRate  Float  @default(0) // % who viewed all pages
  lastViewedAt    DateTime?
  updatedAt       DateTime @updatedAt

  // Denormalized for fast reads — updated by background job
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/track` | No | Receive beacon events (rate-limited by IP) |
| GET | `/api/documents/[id]/analytics` | Yes | Overview: views, visitors, avg time |
| GET | `/api/documents/[id]/analytics/heatmap` | Yes | Per-page time data for heatmap |
| GET | `/api/documents/[id]/analytics/visitors` | Yes | List visitors + their engagement |
| GET | `/api/documents/[id]/analytics/timeline` | Yes | View events over time |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `AnalyticsDashboard` | Overview cards: views, visitors, avg time, completion |
| `PageHeatmap` | Visual heatmap — pages colored by engagement (red = hot) |
| `TimePerPageChart` | Bar chart of average time per page |
| `VisitorTable` | Sortable table: email, views, time, last active, device |
| `EngagementTimeline` | Line chart of views over time |
| `ScrollDepthChart` | Shows how far visitors scroll on each page |
| `LiveViewIndicator` | Real-time: "2 people viewing right now" |

### Priority & Complexity
- **Priority:** P1 — Huge value, shares infrastructure with Deal Rooms
- **Complexity:** Medium (2-3 weeks)
- **Dependencies:** Tracking infrastructure (shared with Deal Rooms)

---

## 7. Doc Expiry + FOMO (#15)

### What It Is
Documents can have an expiration date with a live countdown timer visible to the recipient. Once expired, the document can no longer be signed. Senders get email reminders before expiry, and recipients see urgency ("Expires in 2h 34m").

### Why It Matters
Creates urgency that dramatically speeds up signing. Sales proposals that "expire Friday" get signed Thursday. The visible countdown is a psychological nudge that converts fence-sitters without being pushy.

### Technical Architecture

**Flow:**
1. Owner sets expiry when creating/sending doc (optional)
2. Recipient sees live countdown timer on the document page
3. API checks expiry on every action (sign, comment) — rejects if expired
4. Background job sends reminder emails: 24h before, 2h before
5. On expiry: status → EXPIRED, link shows "This document has expired"

**Countdown Component:**
```typescript
// Real-time countdown — no server calls needed
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const left = getTimeLeft(expiresAt);
      if (left.total <= 0) {
        clearInterval(interval);
        router.refresh(); // reload to show expired state
      }
      setTimeLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="flex gap-2 text-red-600 font-mono">
      <span>{timeLeft.days}d</span>
      <span>{timeLeft.hours}h</span>
      <span>{timeLeft.minutes}m</span>
      <span>{timeLeft.seconds}s</span>
    </div>
  );
}
```

**Expiry Enforcement (middleware-level):**
```typescript
// In /api/d/[token] route handler
const doc = await prisma.document.findUnique({ where: { token } });
if (doc.expiresAt && new Date() > doc.expiresAt) {
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'EXPIRED' }
  });
  return NextResponse.json({ error: 'Document has expired' }, { status: 410 });
}
```

**Reminder Cron (via Inngest or Vercel Cron):**
```typescript
// Run every hour
export async function checkExpiringDocs() {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const docs = await prisma.document.findMany({
    where: {
      expiresAt: { lte: soon, gt: new Date() },
      status: 'SENT',
      expiryReminderSent: false
    }
  });
  for (const doc of docs) {
    await sendExpiryReminder(doc);
    await prisma.document.update({
      where: { id: doc.id },
      data: { expiryReminderSent: true }
    });
  }
}
```

### Database Schema

```prisma
// Extends the Document model
model Document {
  // ... existing fields ...
  expiresAt           DateTime?
  expiryReminderSent  Boolean   @default(false)
  expiryReminder2hSent Boolean  @default(false)
}

model ExpiryConfig {
  id          String @id @default(cuid())
  userId      String
  user        User   @relation(fields: [userId], references: [id])
  defaultExpiry Int? // default days until expiry (null = no expiry)
  reminderHours Int[] @default([24, 2]) // when to send reminders
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| PUT | `/api/documents/[id]/expiry` | Yes | Set/update/remove expiry |
| GET | `/api/d/[token]` | No | Returns `expiresAt` in response |
| POST | `/api/cron/check-expiry` | Cron | Process expiring docs |
| POST | `/api/documents/[id]/extend` | Yes | Extend expiry date |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `CountdownTimer` | Live countdown display (days/hours/min/sec) |
| `ExpiryBadge` | Color-coded badge: green (>7d), yellow (1-7d), red (<24h) |
| `ExpiryPicker` | Date/time picker for setting expiry |
| `ExpiredOverlay` | Full-page overlay when doc has expired |
| `ExpiryBanner` | "This doc expires in X" banner on viewer |
| `ExtendExpiryButton` | Quick-extend button for doc owner |

### Priority & Complexity
- **Priority:** P1 — Easy to build, massive conversion impact
- **Complexity:** Low (1 week)
- **Dependencies:** Document model, email service, cron/background jobs

---

## 8. Git-Style Versioning (#21)

### What It Is
Every document change is stored as a version with a snapshot, creating a complete version history. Users can view any previous version, compare two versions side-by-side with a visual diff, and restore old versions — just like Git for documents.

### Why It Matters
Contracts go through many iterations. Without versioning, changes are lost or disputed. Git-style versioning provides a tamper-proof audit trail, easy rollback, and clear diff views that show exactly what changed between versions.

### Technical Architecture

**Flow:**
1. Every time a doc is updated (re-upload, accepted suggestion, manual edit) → new version created
2. Version stores: full file snapshot (S3) + extracted text (for diffing) + metadata
3. User can browse version history timeline
4. Select two versions → side-by-side diff view
5. "Restore" any version → creates a new version (non-destructive)

**Diff Strategy:**
- Extract text from each PDF version (pdf-parse or pdfjs)
- Use `diff` library (npm) for word-level or line-level diff
- For visual diff: render both PDFs side-by-side with highlighted differences
- Store extracted text per version for fast diffing (don't re-extract)

**Text Diff Implementation:**
```typescript
import { diffWords } from 'diff';

function computeDiff(oldText: string, newText: string) {
  const changes = diffWords(oldText, newText);
  return changes.map(part => ({
    value: part.value,
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged'
  }));
}
```

**Route Structure:**
```
app/api/documents/[id]/versions/route.ts          → GET list, POST create
app/api/documents/[id]/versions/[versionId]/route.ts → GET version detail
app/api/documents/[id]/versions/diff/route.ts      → GET diff between two versions
app/api/documents/[id]/versions/[versionId]/restore/route.ts → POST restore
```

### Database Schema

```prisma
model DocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  version     Int      // sequential: 1, 2, 3...
  fileUrl     String   // S3 URL to this version's PDF
  fileHash    String   // SHA-256
  fileSize    Int
  extractedText String? @db.Text // for diffing
  changeNote  String?  // "Accepted pricing change", "Updated terms"
  createdBy   String   // email of who made the change
  changeType  VersionChangeType
  parentVersionId String? // which version this was based on
  createdAt   DateTime @default(now())

  @@unique([documentId, version])
  @@index([documentId])
}

enum VersionChangeType {
  UPLOAD          // initial or re-upload
  SUGGESTION      // accepted suggestion
  RESTORE         // restored from older version
  EDIT            // manual edit
}

model DiffCache {
  id          String @id @default(cuid())
  versionAId  String
  versionBId  String
  diffData    Json   // cached diff result
  createdAt   DateTime @default(now())

  @@unique([versionAId, versionBId])
}
```

### Key API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/documents/[id]/versions` | Yes | List all versions |
| POST | `/api/documents/[id]/versions` | Yes | Create new version (upload) |
| GET | `/api/documents/[id]/versions/[vid]` | Yes | Get version detail + download URL |
| GET | `/api/documents/[id]/versions/diff?a=1&b=3` | Yes | Compute diff between v1 and v3 |
| POST | `/api/documents/[id]/versions/[vid]/restore` | Yes | Restore version (creates new) |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `VersionTimeline` | Vertical timeline showing all versions with metadata |
| `VersionCard` | Individual version: number, date, author, change note |
| `DiffViewer` | Side-by-side view with highlighted additions/removals |
| `DiffSelector` | Dropdown to pick two versions to compare |
| `RestoreButton` | Restore a previous version (with confirmation) |
| `VersionBadge` | Shows current version number on document |
| `ChangeNoteInput` | Text input for describing what changed |
| `TextDiffHighlight` | Renders word-level diff with green/red highlighting |

### Priority & Complexity
- **Priority:** P2 — Important for trust/audit, but can ship after core signing works
- **Complexity:** Medium-High (3-4 weeks)
- **Dependencies:** File storage with versioned objects, PDF text extraction

---

## Summary Table

| # | Feature | Priority | Complexity | Weeks |
|---|---------|----------|------------|-------|
| 2 | One-Link Everything | P0 | Medium | 2-3 |
| 6 | Free Forever 3 Docs/Month | P0 | Low-Medium | 1-2 |
| 5 | Deal Rooms | P1 | High | 3-4 |
| 12 | API-First + Zapier | P1 | Medium | 3-4 |
| 13 | Document Analytics | P1 | Medium | 2-3 |
| 15 | Doc Expiry + FOMO | P1 | Low | 1 |
| 11 | Version Negotiation | P2 | High | 4-6 |
| 21 | Git-Style Versioning | P2 | Medium-High | 3-4 |

**Recommended build order:** #2 → #6 → #15 → #13 → #5 → #12 → #21 → #11

Total estimated time: **19-27 weeks** for all 8 features.
