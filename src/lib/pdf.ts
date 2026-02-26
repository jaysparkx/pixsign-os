import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import prisma from "./prisma";
import { readFile, saveFile, hashBuffer } from "./storage";

export async function validatePdf(buffer: Buffer): Promise<{ pages: number }> {
  const doc = await PDFDocument.load(buffer);
  return { pages: doc.getPageCount() };
}

export async function finalizeDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      fields: { include: { recipient: true } },
      recipients: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!doc) throw new Error("Document not found");

  // 1. Load original PDF
  const original = readFile(doc.originalPath);
  const pdfDoc = await PDFDocument.load(original);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 2. Embed each completed field
  for (const field of doc.fields) {
    if (!field.signedAt) continue;
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { height: ph } = page.getSize();
    const pdfY = ph - field.y - field.height;

    if ((field.type === "SIGNATURE" || field.type === "INITIALS") && field.value) {
      // value holds base64 PNG data URL
      try {
        const base64 = field.value.replace(/^data:image\/png;base64,/, "");
        const imgBuf = Buffer.from(base64, "base64");
        const img = await pdfDoc.embedPng(imgBuf);
        page.drawImage(img, { x: field.x, y: pdfY, width: field.width, height: field.height });
      } catch (e) { console.error("Embed sig error", e); }
    } else if (field.type === "CHECKBOX") {
      page.drawRectangle({ x: field.x, y: pdfY, width: field.width, height: field.height, borderColor: rgb(0.3,0.3,0.5), borderWidth: 1 });
      if (field.value === "true") {
        page.drawText("✓", { x: field.x + 2, y: pdfY + 2, size: field.height - 4, font: fontBold, color: rgb(0.1,0.66,0.4) });
      }
    } else if (field.value) {
      page.drawRectangle({ x: field.x, y: pdfY, width: field.width, height: field.height, color: rgb(0.97,0.97,1), borderColor: rgb(0.7,0.7,0.85), borderWidth: 0.5 });
      const maxChars = Math.floor(field.width / 6.5);
      const text = field.value.length > maxChars ? field.value.substring(0, maxChars - 2) + "…" : field.value;
      page.drawText(text, { x: field.x + 4, y: pdfY + field.height / 2 - 5, size: 11, font, color: rgb(0.1,0.1,0.2) });
    }
  }

  // 3. Add audit page
  const audit = pdfDoc.addPage([612, 792]);
  const { width, height } = audit.getSize();
  let y = height - 48;

  // Header bar
  audit.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: rgb(0.08,0.08,0.18) });
  audit.drawText("AUDIT CERTIFICATE", { x: 48, y: height - 30, size: 15, font: fontBold, color: rgb(1,1,1) });
  audit.drawText(`Generated: ${new Date().toISOString()}`, { x: 48, y: height - 52, size: 9, font, color: rgb(0.57,0.57,0.71) });
  y = height - 92;

  // Document info
  audit.drawText("DOCUMENT", { x: 48, y, size: 8, font: fontBold, color: rgb(0.42,0.42,0.59) });
  y -= 14;
  audit.drawText(doc.title, { x: 48, y, size: 12, font: fontBold, color: rgb(0.88,0.88,0.92) });
  y -= 12;
  audit.drawText(`ID: ${doc.id}`, { x: 48, y, size: 8, font, color: rgb(0.42,0.42,0.59) });
  y -= 20;

  // Hash
  audit.drawText("INTEGRITY", { x: 48, y, size: 8, font: fontBold, color: rgb(0.42,0.42,0.59) });
  y -= 14;
  audit.drawText(`Original SHA-256: ${doc.originalHash}`, { x: 48, y, size: 7.5, font, color: rgb(0.57,0.57,0.71) });
  y -= 26;

  // Signers
  audit.drawText("SIGNERS", { x: 48, y, size: 8, font: fontBold, color: rgb(0.42,0.42,0.59) });
  y -= 14;

  for (const r of doc.recipients) {
    if (y < 80) break;
    const signed = r.status === "SIGNED";
    audit.drawCircle({ x: 55, y: y + 4, size: 4, color: signed ? rgb(0.1,0.66,0.4) : rgb(1,0.1,0.42) });
    audit.drawText(`${r.name} <${r.email}>`, { x: 68, y: y + 2, size: 10, font: fontBold, color: rgb(0.88,0.88,0.92) });
    audit.drawText(signed ? `SIGNED ${r.signedAt?.toISOString() || ""}` : r.status, { x: 68, y: y - 10, size: 8, font, color: signed ? rgb(0.1,0.66,0.4) : rgb(0.57,0.57,0.71) });
    if (r.ipAddress) audit.drawText(`IP: ${r.ipAddress}`, { x: 68, y: y - 21, size: 7.5, font, color: rgb(0.42,0.42,0.59) });
    y -= 38;
  }

  // Events
  y -= 8;
  audit.drawText("ACTIVITY LOG", { x: 48, y, size: 8, font: fontBold, color: rgb(0.42,0.42,0.59) });
  y -= 14;
  for (const ev of doc.events.slice(0, 15)) {
    if (y < 60) break;
    audit.drawText(`${new Date(ev.createdAt).toISOString()}  ${ev.type.replace(/_/g," ")}`, { x: 48, y, size: 8, font, color: rgb(0.57,0.57,0.71) });
    y -= 12;
  }

  // Footer
  audit.drawLine({ start: { x: 48, y: 40 }, end: { x: width - 48, y: 40 }, thickness: 0.5, color: rgb(0.16,0.16,0.32) });
  audit.drawText("This certificate serves as evidence of the electronic signing process.", { x: 48, y: 26, size: 7, font, color: rgb(0.42,0.42,0.59) });

  const finalBytes = await pdfDoc.save();
  const finalBuf = Buffer.from(finalBytes);
  const signedHash = hashBuffer(finalBuf);
  const signedPath = saveFile(finalBuf, "signed", "pdf");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "COMPLETED", signedPath, signedHash, completedAt: new Date() },
  });
}
