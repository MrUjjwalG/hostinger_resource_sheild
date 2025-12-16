const nodemailer = require('nodemailer');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendAlertEmail = async (subject, text, context = {}) => {
  try {
    // Support multiple comma-separated emails
    const recipients = process.env.ALERT_EMAIL ? process.env.ALERT_EMAIL.split(',').map(e => e.trim()) : [];

    if (recipients.length === 0) {
      console.warn('No ALERT_EMAIL configured, skipping email send.');
      return;
    }

    // Determine template path (env var or default)
    const templatePath = process.env.EMAIL_TEMPLATE_PATH
      ? path.resolve(process.cwd(), process.env.EMAIL_TEMPLATE_PATH)
      : path.join(__dirname, '../email-template.html');

    let htmlContent;

    if (fs.existsSync(templatePath)) {
      let template = fs.readFileSync(templatePath, 'utf8');

      // Default context values
      const fullContext = {
        subject,
        text: text.replace(/</g, "&lt;").replace(/>/g, "&gt;"), // Basic XSS prevention for fallback
        timestamp: new Date().toLocaleString(),
        ...context // Override with passed context
      };

      // Replace all {{key}} in template with values from context
      Object.keys(fullContext).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, fullContext[key]);
      });

      htmlContent = template;
    } else {
      // Fallback if no template found
      htmlContent = `<b>${text.replace(/\n/g, '<br>')}</b>`;
    }

    // Support CC recipients
    const ccRecipients = process.env.ALERT_CC ? process.env.ALERT_CC.split(',').map(e => e.trim()) : [];

    const info = await transporter.sendMail({
      from: `"Resource Shield" <${process.env.SMTP_USER}>`,
      to: recipients,
      cc: ccRecipients,
      subject: subject,
      text: text, // Plain text body
      html: htmlContent, // HTML body
    });

    console.log("Message sent to %s (CC: %s): %s", recipients.join(', '), ccRecipients.join(', '), info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = { sendAlertEmail };
