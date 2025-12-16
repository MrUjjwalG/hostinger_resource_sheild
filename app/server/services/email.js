const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendAlertEmail = async (subject, text) => {
  try {
    const info = await transporter.sendMail({
      from: `"Resource Shield" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL,
      subject: subject,
      text: text,
      html: `<b>${text}</b>`,
    });
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = { sendAlertEmail };
