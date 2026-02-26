# eSign MVP

Full-stack e-signature platform. **No cloud services required** — SQLite database, local file storage.

## Stack
- **Next.js 14** — full stack (app router + API routes)
- **Prisma + SQLite** — zero setup database, file at `prisma/dev.db`
- **Local file storage** — PDFs saved to `/public/uploads/`
- **Nodemailer** — emails via Gmail SMTP (or any SMTP)
- **pdf-lib** — embed signatures into PDFs + generate audit trail
- **PDF.js** — render PDF pages in the browser

## Setup (5 minutes)

```bash
# 1. Install
npm install

# 2. Configure email (copy and edit)
cp .env.example .env.local

# 3. Create DB
npx prisma db push

# 4. Run
npm run dev
```

Open http://localhost:3000

## Email config (`.env.local`)

The only thing you need to configure is SMTP. Gmail is easiest:

1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Generate an app password for "Mail"
3. Put it in `.env.local`:

```
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM=you@gmail.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## How it works

### Sender flow
1. Upload a PDF → `/documents/:id/prepare`
2. Drag-drop signature/text/date fields onto the PDF pages
3. Add recipients (signers) with their emails
4. Click "Send for Signature" → emails go out with unique signing links

### Signer flow
1. Recipient gets email with link → `/sign/:docId/:token`
2. Views PDF, clicks fields to sign (draw / type / upload)
3. Confirms consent → submits
4. If all parties signed → PDF is finalized with embedded signatures + audit trail appended

### After completion
- Final PDF with embedded signatures is saved to `/public/uploads/signed/`
- Audit trail page is appended showing all signer details, timestamps, IPs
- Completion email sent to all parties with download link

## File structure

```
src/
  app/
    page.tsx                    # Dashboard
    documents/[id]/
      page.tsx                  # Document detail + send
      prepare/page.tsx          # PDF field editor
      analytics/page.tsx        # Analytics
    sign/[docId]/[token]/
      page.tsx                  # Signing experience
  api/
    documents/                  # CRUD + send + void + download + analytics
    sign/[docId]/[token]/       # Load session + submit + decline
  lib/
    prisma.ts                   # DB client
    storage.ts                  # Local file save/read
    email.ts                    # Nodemailer templates
    pdf.ts                      # pdf-lib: embed fields + audit page
    events.ts                   # Event logging
prisma/
  schema.prisma                 # SQLite schema
public/uploads/                 # Auto-created, stores all PDFs
```

## To deploy

For production, switch from SQLite to PostgreSQL (Neon free tier):
1. Change `prisma/schema.prisma` datasource provider to `postgresql`
2. Set `DATABASE_URL` to your Neon connection string
3. For file storage, swap `src/lib/storage.ts` to use Cloudflare R2 or AWS S3

Everything else stays the same.
