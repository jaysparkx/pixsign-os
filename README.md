<p align="center">
  <img src="https://img.shields.io/badge/Pixsign-Document%20Intelligence-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xNCAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOHoiLz48cG9seWxpbmUgcG9pbnRzPSIxNCAyIDE0IDggMjAgOCIvPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIi8+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciLz48cG9seWxpbmUgcG9pbnRzPSIxMCA5IDkgOSA4IDkiLz48L3N2Zz4=" alt="Pixsign">
</p>

<h1 align="center">Pixsign</h1>

<p align="center">
  <strong>Open-source document signing & intelligence platform</strong><br>
  <em>Send. Sign. Seal. Automate.</em>
</p>

<p align="center">
  <a href="https://pixsign.io">Website</a> •
  <a href="https://app.pixsign.io">Live App</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Get Started</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js 14">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?style=flat-square&logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/Cloudflare-R2-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="License">
</p>

---

## Overview

**Pixsign** is a full-stack document signing platform built for speed, privacy, and extensibility. Upload PDFs, place signature fields with drag-and-drop, send to recipients, and get legally-binding e-signatures — all from a clean, modern interface.

Built as a self-hostable alternative to DocuSign, PandaDoc, and HelloSign — with AI capabilities on the horizon.

**Live at** → [app.pixsign.io](https://app.pixsign.io)

---

## Features

### ✍️ Core Signing

| Feature | Description |
|---|---|
| **PDF Upload & Prep** | Upload any PDF, drag-and-drop signature/text/date fields onto pages |
| **Multi-Recipient Signing** | Add unlimited signers with individual field assignments |
| **3 Signature Modes** | Draw, type, or upload an image — signers choose their style |
| **Signing Links** | Unique tokenized URLs sent via email — no account required to sign |
| **Legal Audit Trail** | Timestamped log of every action (IP, user agent, consent) appended to final PDF |
| **PDF Finalization** | Signatures embedded directly into the PDF with `pdf-lib` — tamper-evident |
| **Completion Emails** | All parties notified with download link when signing is complete |

### 📊 Dashboard & Management

| Feature | Description |
|---|---|
| **Document Dashboard** | Grid/list views, search, status filters (Draft, Sent, In Progress, Completed, Declined, Voided) |
| **Folder Organization** | Create folders, move documents — keep everything structured |
| **Analytics** | Per-document and global analytics — views, opens, completion rates, time to sign |
| **Document Sharing** | Public share links with read-only PDF viewer |
| **Copy & Resend** | Duplicate documents, resend signing requests |
| **Void Documents** | Cancel in-progress documents at any time |
| **Activity Timeline** | Full event log per document — who did what, when |

### 🔐 Authentication & Security

| Feature | Description |
|---|---|
| **Better Auth** | Email/password auth with secure session management |
| **Middleware Protection** | Route-level auth guards — API returns 401, pages redirect to login |
| **Security Headers** | HSTS, CSP, X-Frame-Options, referrer policy — production-hardened |
| **HTTPS Enforced** | Strict transport security with preload |
| **Session Cookies** | Secure, HTTP-only session tokens |

### 🎨 User Experience

| Feature | Description |
|---|---|
| **Dark Mode** | System/light/dark theme toggle with persistence |
| **Responsive Design** | Mobile-friendly layouts across all pages |
| **Toast Notifications** | Real-time feedback on every action |
| **Framer Motion** | Smooth page transitions and micro-animations |
| **Keyboard Shortcuts** | Quick navigation throughout the app |

---

## Tech Stack

```
Frontend          Next.js 14 (App Router) · React 18 · Tailwind CSS · Framer Motion
Backend           Next.js API Routes (serverless) · TypeScript
Database          PostgreSQL (via Prisma ORM)
Auth              Better Auth (session-based)
Storage           Cloudflare R2 (S3-compatible) · local filesystem fallback
PDF Engine        pdf-lib (embed signatures) · PDF.js (render in browser)
Email             Resend (transactional emails)
Hosting           Netlify (frontend + serverless functions)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database (local or [Neon](https://neon.tech) free tier)
- **Cloudflare R2** bucket (optional — falls back to local storage)

### Installation

```bash
# Clone
git clone https://github.com/jaysparkx/pixsign.git
cd pixsign

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL, auth secret, R2 keys, etc.

# Set up database
npx prisma db push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Direct DB connection (for migrations) |
| `BETTER_AUTH_SECRET` | ✅ | Auth encryption key (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | ✅ | App URL for auth callbacks |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public-facing app URL |
| `R2_ACCOUNT_ID` | ○ | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | ○ | R2 access key |
| `R2_SECRET_ACCESS_KEY` | ○ | R2 secret key |
| `R2_BUCKET` | ○ | R2 bucket name |
| `RESEND_API_KEY` | ○ | Resend API key for emails |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (React)                 │
│  Dashboard · Doc Prep · Signing · Analytics      │
├─────────────────────────────────────────────────┤
│               Middleware (Auth Guard)             │
│        Session validation · Security headers      │
├─────────────────────────────────────────────────┤
│              Next.js API Routes                   │
│  /api/documents/* · /api/sign/* · /api/auth/*     │
├──────────┬──────────┬──────────┬────────────────┤
│  Prisma  │    R2    │  pdf-lib │    Resend      │
│ (Postgres)│ (Storage)│  (PDF)   │   (Email)      │
└──────────┴──────────┴──────────┴────────────────┘
```

### Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard (grid/list, folders, search)
│   ├── login/page.tsx              # Authentication
│   ├── analytics/page.tsx          # Global analytics
│   ├── settings/page.tsx           # User settings (profile, appearance)
│   ├── share/[id]/page.tsx         # Public document viewer
│   ├── documents/[id]/
│   │   ├── page.tsx                # Document detail + send
│   │   ├── prepare/page.tsx        # Drag-drop field editor
│   │   └── analytics/page.tsx      # Per-document analytics
│   ├── sign/[docId]/[token]/
│   │   └── page.tsx                # Signing experience (no auth required)
│   └── api/
│       ├── documents/              # CRUD, upload, send, void, download, share, copy
│       ├── sign/[docId]/[token]/   # Load session, submit, decline
│       ├── auth/[...all]/          # Better Auth handler
│       ├── analytics/              # Analytics aggregation
│       └── track/                  # Event tracking
├── lib/
│   ├── prisma.ts                   # Database client
│   ├── storage.ts                  # R2/local file abstraction
│   ├── pdf.ts                      # Signature embedding + audit trail
│   ├── email.ts                    # Email templates
│   ├── auth.ts                     # Better Auth config
│   ├── auth-client.ts              # Client-side auth hooks
│   ├── events.ts                   # Event logging
│   ├── get-user.ts                 # Server-side user extraction
│   └── theme.tsx                   # Theme provider
├── middleware.ts                    # Auth guards + security headers
└── prisma/
    └── schema.prisma               # Database schema
```

---

## Signing Flow

```
  Sender                              Signer
    │                                    │
    ├─ Upload PDF                        │
    ├─ Place fields (drag & drop)        │
    ├─ Add recipients                    │
    ├─ Send ─────────────────────────►  📧 Email received
    │                                    │
    │                                    ├─ Click unique link
    │                                    ├─ View document
    │                                    ├─ Sign fields (draw/type/upload)
    │                                    ├─ Consent & submit
    │                                    │
    │  ◄──────────── Notification ───────┤
    │                                    │
    ├─ All signed → PDF finalized        │
    ├─ Audit trail appended              │
    └─ Completion email to all parties   │
```

---

## Roadmap

### 🤖 AI Tools `coming soon`

| Feature | Description | Status |
|---|---|---|
| **AI Document Generation** | Generate contracts, NDAs, agreements from natural language prompts | 🔜 Next |
| **AI Contract Review** | Upload a contract → get risk analysis, clause summaries, red flags | 🔜 Next |
| **Smart Analysis** | Extract key terms, dates, obligations, and parties from any document | 🔜 Next |
| **AI Agent Integration** | Connect external AI agents (MCP, API) to automate document workflows | 🔜 Planned |

### 💳 Payments & Plans

| Feature | Description | Status |
|---|---|---|
| **Subscription Plans** | Free / Pro / Enterprise tiers with usage limits | 🔜 Planned |
| **Payment Gateway** | Stripe or Tap Payments integration | 🔜 Planned |
| **Usage Metering** | Track documents sent per month, enforce plan limits | 🔜 Planned |
| **Billing Portal** | Self-serve plan management, invoices, payment methods | 🔜 Planned |

### 📤 DocSend-Style Features

| Feature | Description | Status |
|---|---|---|
| **Smart Share Links** | Password-protected, expiring links with download control | 🔜 Planned |
| **View Analytics** | Who viewed, how long, which pages — per-link tracking | 🔜 Planned |
| **Data Rooms** | Secure virtual data rooms for due diligence (M&A, fundraising) | 📋 Backlog |
| **Link Watermarking** | Auto-watermark PDFs per viewer for leak detection | 📋 Backlog |
| **NDA-Gated Access** | Require signing an NDA before viewing documents | 📋 Backlog |

### 📝 Advanced Signing

| Feature | Description | Status |
|---|---|---|
| **Templates** | Save document layouts as reusable templates | 🔜 Planned |
| **Bulk Send** | Send the same template to multiple recipients at once | 🔜 Planned |
| **Signing Order** | Sequential signing — signer B waits for signer A | 🔜 Planned |
| **In-Person Signing** | Hand the device to someone for in-person signatures | 📋 Backlog |
| **SMS Verification** | OTP verification before signing for extra security | 📋 Backlog |
| **QES / eIDAS** | Qualified Electronic Signatures for EU compliance | 📋 Backlog |

### 🔌 Integrations

| Feature | Description | Status |
|---|---|---|
| **API & Webhooks** | REST API + webhook events for document lifecycle | 🔜 Planned |
| **Zapier / Make** | No-code automation triggers | 📋 Backlog |
| **Google Drive / Dropbox** | Import/export documents from cloud storage | 📋 Backlog |
| **CRM Integration** | Salesforce, HubSpot — send documents from your CRM | 📋 Backlog |
| **Slack / Teams** | Notifications when documents are signed | 📋 Backlog |

### 🏗️ Infrastructure

| Feature | Description | Status |
|---|---|---|
| **Team Workspaces** | Multi-user organizations with role-based access | 🔜 Planned |
| **Audit Compliance** | SOC 2, HIPAA-ready audit logging | 📋 Backlog |
| **Self-Hosted Docker** | One-command deployment with Docker Compose | 📋 Backlog |
| **White-Label** | Custom branding, domain, and email templates | 📋 Backlog |

---

## Deployment

### Netlify (Current Production)

The app is deployed on Netlify with automatic builds:

```toml
# netlify.toml
[build]
  command = "npx prisma generate && npm run build"
  publish = ".next"

[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

### Self-Hosted

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2
pm2 start npm --name pixsign -- start
```

---

## Contributing

Pixsign is currently in active development. If you're interested in contributing, reach out via [GitHub Issues](https://github.com/jaysparkx/pixsign/issues).

---

## License

Proprietary — All rights reserved.

---

<p align="center">
  <strong>Built by <a href="https://github.com/jaysparkx">JAY.S</a></strong><br>
  <sub>Pixsign — making document signing fast, beautiful, and intelligent.</sub>
</p>
