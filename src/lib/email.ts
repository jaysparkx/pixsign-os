import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `${process.env.EMAIL_FROM_NAME || "PixSign"} <${process.env.EMAIL_FROM || "noreply@pixsign.ai"}>`;
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{background:#0a0a1a;font-family:system-ui,sans-serif;margin:0;padding:40px 20px}
    .box{max-width:560px;margin:0 auto;background:#14142e;border:1px solid #2a2a52;border-radius:14px;overflow:hidden}
    .hdr{padding:24px 32px;border-bottom:1px solid #2a2a52}
    .logo{font-size:20px;font-weight:800;color:#fff}
    .logo span{color:#ff1a6b}
    .body{padding:32px}
    h2{color:#fff;margin:0 0 12px;font-size:20px}
    p{color:#9292b8;font-size:14px;line-height:1.6;margin:0 0 16px}
    .btn{display:inline-block;padding:13px 28px;background:#ff1a6b;color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:8px 0 20px}
    .info{background:#1e1e40;border-radius:8px;padding:14px;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
    .l{color:#6b6b96}.v{color:#e0e0eb;font-weight:500}
    .ftr{padding:20px 32px;border-top:1px solid #2a2a52}
    .ftr p{font-size:11px;color:#383866;margin:0}
  </style></head><body><div class="box">
    <div class="hdr"><span class="logo">Pix<span>Sign</span></span></div>
    <div class="body">${body}</div>
    <div class="ftr"><p>Automated message from PixSign. Do not reply.</p></div>
  </div></body></html>`;
}

export async function sendSigningRequest(args: {
  to: string; toName: string; senderName: string;
  docTitle: string; message?: string; signingUrl: string; expiresAt?: Date;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [args.to],
    subject: `${args.senderName} sent you a document to sign`,
    html: wrap(`
      <h2>You have a document to sign</h2>
      <p>Hi ${args.toName},</p>
      <p><strong style="color:#fff">${args.senderName}</strong> needs your signature on a document.</p>
      ${args.message ? `<div class="info"><p style="color:#c1c1d7;font-style:italic;margin:0">"${args.message}"</p></div>` : ""}
      <div class="info">
        <div class="row"><span class="l">Document</span><span class="v">${args.docTitle}</span></div>
        <div class="row"><span class="l">From</span><span class="v">${args.senderName}</span></div>
        ${args.expiresAt ? `<div class="row"><span class="l">Expires</span><span class="v">${args.expiresAt.toLocaleDateString()}</span></div>` : ""}
      </div>
      <a href="${args.signingUrl}" class="btn">Review &amp; Sign</a>
      <p style="font-size:12px;color:#4a4a7a">Can't click the button? ${args.signingUrl}</p>
    `),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendCompletionEmail(args: {
  to: string; toName: string; docTitle: string; downloadUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [args.to],
    subject: `✓ Completed: ${args.docTitle}`,
    html: wrap(`
      <h2>Document signed by all parties</h2>
      <p>Hi ${args.toName},</p>
      <p>All parties have signed <strong style="color:#fff">${args.docTitle}</strong>. Your completed document is ready.</p>
      <a href="${args.downloadUrl}" class="btn">Download Signed Document</a>
    `),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendDeclinedEmail(args: {
  to: string; toName: string; declinerName: string; docTitle: string; reason?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [args.to],
    subject: `Signing declined: ${args.docTitle}`,
    html: wrap(`
      <h2>Document signing declined</h2>
      <p><strong style="color:#fff">${args.declinerName}</strong> declined to sign "${args.docTitle}".</p>
      ${args.reason ? `<div class="info"><div class="row"><span class="l">Reason</span><span class="v">${args.reason}</span></div></div>` : ""}
    `),
  });
  if (error) throw new Error(error.message);
  return data;
}
