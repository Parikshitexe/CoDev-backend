import nodemailer from 'nodemailer';

export const sendEmail = async (options) => {
  // Use Ethereal for testing if no real SMTP credentials are provided in .env
  let transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Real SMTP config
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Ethereal mock config
    // We create a test account on the fly if none exists
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("Using Ethereal Email for testing.");
  }

  const message = {
    from: `${process.env.FROM_NAME || 'CoDev'} <${process.env.FROM_EMAIL || 'noreply@codev.local'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  if (!process.env.SMTP_HOST) {
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
};
