import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  ok: boolean;
  error?: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendEmail(opts: EmailOptions): Promise<EmailResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[email] SMTP_HOST no configurado — email no enviado');
    return { ok: false, error: 'SMTP no configurado. Configure SMTP_HOST en las variables de entorno.' };
  }

  const from = opts.from ?? process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'noreply@rentiq.local';

  try {
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al enviar email';
    console.error('[email] Error enviando:', message);
    return { ok: false, error: message };
  }
}
