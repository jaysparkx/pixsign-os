# Changelog

## [0.2.0] - 2026-03-03

### Added
- **Figma-style field editor** — drag, draw, resize, and stamp fields on PDF pages
- **7 field types**: Signature, Initials, Date, Text, Checkbox, Full Name, Email
- **Color-coded recipients** with visual field assignment
- **"Next field" navigation** for signers — guides to unfilled required fields
- **Field highlight animation** — draws signer attention to pending fields
- **ChunkErrorBoundary** — graceful recovery from stale deploys (no more white screens)
- **Tool modes**: Select, Draw, Stamp (click-to-place)
- **Context menus** on fields (right-click)
- **Resize handles** on all field types

### Fixed
- **PDF generation crash** on non-WinAnsi characters (smart quotes, em-dashes, ellipsis)
- **Signed PDF download** — proper PNG/JPEG fallback for signature embedding
- **Scale capping** at 1.0 — PDF never stretches beyond natural size
- **Completion tracking** — correctly validates each field type before enabling submit

### Changed
- Prepare page completely rewritten with Figma-style UX
- Signer page UX overhaul with progress tracking
- Document view page cleanup and formatting

## [0.1.0] - 2026-03-01

### Added
- Initial open-source release
- Document upload, recipient management, email invitations
- PDF signing with signature pad
- Cloudflare R2 storage, Better Auth, Prisma ORM
- Landing page with feature showcase
