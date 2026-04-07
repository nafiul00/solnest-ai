/**
 * Email Report Sender
 *
 * Sends the weekly PriceLabs analysis report via Gmail SMTP.
 * Requires a Gmail App Password (not your regular password).
 *
 * To create an App Password:
 * 1. Go to https://myaccount.google.com/apppasswords
 * 2. Select "Mail" and your device
 * 3. Copy the 16-character password into .env
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendReport(reportPath, fullReport, screenshots = []) {
  // Validate required env vars before attempting to send
  const missing = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'REPORT_TO_EMAIL'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars for email: ${missing.join(', ')}`);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build attachments array — only attach report if it exists on disk
  const attachments = [];
  if (fs.existsSync(reportPath)) {
    attachments.push({
      filename: path.basename(reportPath),
      path: reportPath
    });
  }

  // Add neighborhood screenshots if they exist
  for (const screenshot of screenshots) {
    if (screenshot && fs.existsSync(screenshot)) {
      attachments.push({
        filename: path.basename(screenshot),
        path: screenshot
      });
    }
  }

  const safeReport = htmlEscape(fullReport);

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.REPORT_TO_EMAIL,
    subject: `Solnest Stays — Weekly Pricing Report — ${today}`,
    text: `Your weekly PriceLabs pricing analysis is attached.\n\n${fullReport}`,
    html: `
      <h2>Solnest Stays — Weekly Pricing Report</h2>
      <p><strong>${today}</strong></p>
      <hr>
      <pre style="font-family: monospace; white-space: pre-wrap; font-size: 14px;">${safeReport}</pre>
      <hr>
      <p><em>Generated automatically by PriceLabs Analyzer Agent</em></p>
      <p><em>This is a report-only analysis. No changes were made to your PriceLabs settings.</em></p>
    `,
    attachments
  };

  const info = await transporter.sendMail(mailOptions);

  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`Email rejected for recipients: ${info.rejected.join(', ')}`);
  }

  console.log(`Email sent: ${info.messageId}`);
  return info;
}

module.exports = { sendReport };
