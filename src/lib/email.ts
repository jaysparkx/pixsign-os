import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `${process.env.EMAIL_FROM_NAME || "PixSign"} <${process.env.EMAIL_FROM || "noreply@pixsign.io"}>`;
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:linear-gradient(145deg,rgba(14,165,233,0.08) 0%,rgba(6,182,212,0.04) 40%,rgba(34,197,94,0.06) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden">
  <tr><td style="padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em"><span style="color:#fff">Pix</span><span style="color:#0ea5e9">Sign</span></span>
  </td></tr>
  <tr><td style="padding:32px">${body}</td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06)">
    <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;line-height:1.5">Automated message from PixSign. Do not reply.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
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
      <h2 style="color:#fff;margin:0 0 12px;font-size:20px;font-weight:700;letter-spacing:-0.02em">You have a document to sign</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px">Hi ${args.toName},</p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px"><strong style="color:#fff">${args.senderName}</strong> needs your signature on a document.</p>
      ${args.message ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin:16px 0"><p style="color:rgba(255,255,255,0.45);font-style:italic;margin:0;font-size:13px">"${args.message}"</p></div>` : ""}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:16px 0">
        <tr><td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="font-size:12px;color:rgba(255,255,255,0.3)">Document</span><br/><span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500">${args.docTitle}</span></td></tr>
        <tr><td style="padding:10px 14px${args.expiresAt ? ";border-bottom:1px solid rgba(255,255,255,0.04)" : ""}"><span style="font-size:12px;color:rgba(255,255,255,0.3)">From</span><br/><span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500">${args.senderName}</span></td></tr>
        ${args.expiresAt ? `<tr><td style="padding:10px 14px"><span style="font-size:12px;color:rgba(255,255,255,0.3)">Expires</span><br/><span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500">${args.expiresAt.toLocaleDateString()}</span></td></tr>` : ""}
      </table>
      <a href="${args.signingUrl}" style="display:inline-block;padding:14px 32px;background:#fff;color:#000;text-decoration:none;border-radius:14px;font-weight:600;font-size:14px;margin:8px 0 20px">Review &amp; Sign</a>
      <p style="font-size:11px;color:rgba(255,255,255,0.2)">Can't click? ${args.signingUrl}</p>
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
      <h2 style="color:#fff;margin:0 0 12px;font-size:20px;font-weight:700;letter-spacing:-0.02em">Document signed by all parties</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px">Hi ${args.toName},</p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px">All parties have signed <strong style="color:#fff">${args.docTitle}</strong>. Your completed document is ready.</p>
      <div style="text-align:center;padding:8px 0 4px">
        <a href="${args.downloadUrl}" style="display:inline-block;padding:14px 32px;background:#fff;color:#000;text-decoration:none;border-radius:14px;font-weight:600;font-size:14px">Download Signed Document</a>
      </div>
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
      <h2 style="color:#fff;margin:0 0 12px;font-size:20px;font-weight:700;letter-spacing:-0.02em">Document signing declined</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px"><strong style="color:#fff">${args.declinerName}</strong> declined to sign "${args.docTitle}".</p>
      ${args.reason ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:16px 0"><tr><td style="padding:10px 14px"><span style="font-size:12px;color:rgba(255,255,255,0.3)">Reason</span><br/><span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500">${args.reason}</span></td></tr></table>` : ""}
    `),
  });
  if (error) throw new Error(error.message);
  return data;
}
