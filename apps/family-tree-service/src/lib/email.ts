import { configured, type Bindings } from '../env';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Send via Resend's REST API. Without RESEND_API_KEY the message is logged instead (dev mock). */
export async function sendEmail(env: Bindings, msg: EmailMessage): Promise<{ ok: boolean; mocked?: boolean }> {
  if (!configured(env.RESEND_API_KEY)) {
    console.log(`[email:mock] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { ok: true, mocked: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) console.error(`[email] Resend error ${res.status}: ${await res.text()}`);
  return { ok: res.ok };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

/** Minimal branded layout shared by all emails. */
export function emailLayout(title: string, bodyHtml: string, cta?: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 4px;font-size:13px;color:#8a6d3b;letter-spacing:.04em">УРГИЙН БИЧИГ · FAMILY TREE</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="display:inline-block;background:#7c2d12;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(cta.label)}</a></p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}
