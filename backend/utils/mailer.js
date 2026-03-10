const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

let transporter;
let usingEthereal = false;

function createTransportFromEnv() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function useEtherealFallback(reason) {
  console.log(`[mailer] Attempting Ethereal fallback (reason: ${reason})`);
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  usingEthereal = true;
  console.log('[mailer] Using Ethereal test account (emails previewable).');
}

const initPromise = (async () => {
  if (String(process.env.FORCE_ETHEREAL).toLowerCase() === 'true') {
    await useEtherealFallback('FORCE_ETHEREAL=true');
    return;
  }

  transporter = createTransportFromEnv();
  try {
    await transporter.verify();
    console.log('[mailer] SMTP transporter verified');
  } catch (err) {
    console.warn('[mailer] SMTP verify failed (will fallback Ethereal):', err && err.message ? err.message : err);
    try {
      await useEtherealFallback('verify failed');
    } catch (ethErr) {
      console.warn('[mailer] Failed to init Ethereal after verify fail:', ethErr && ethErr.message ? ethErr.message : ethErr);
    }
  }
})();

const fallbackDir = path.join(__dirname, '..', 'logs');
try { fs.mkdirSync(fallbackDir, { recursive: true }); } catch (e) { /* ignore */ }

async function sendMail({ to, subject, text, html }) {
  await initPromise;
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log(`[mailer] Sent mail to ${to} messageId=${info.messageId} response=${info.response}`);
    if (usingEthereal) {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[mailer] Ethereal preview URL: ${preview}`);
    }
    return info;
  } catch (err) {
    console.error('[mailer] sendMail error:', err && err.message ? err.message : err);
    try {
      const record = { ts: new Date().toISOString(), to, subject, text, html, error: (err && err.message) ? err.message : String(err) };
      const file = path.join(fallbackDir, 'email_fallback.log');
      fs.appendFileSync(file, JSON.stringify(record) + '\n');
      console.warn('[mailer] Wrote fallback email to', file);
    } catch (fsErr) {
      console.error('[mailer] Failed to write fallback email:', fsErr && fsErr.message ? fsErr.message : fsErr);
    }
    throw err;
  }
}

module.exports = { sendMail };
