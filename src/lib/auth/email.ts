import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <p>Click the link below to verify your email address:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <p>Click the link below to reset your password:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
}

export async function sendInvitationEmail(
  email: string,
  companyName: string,
  token: string
) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Invitation to join ${companyName} on Accounting Engine`,
    html: `
      <p>You've been invited to join <strong>${companyName}</strong> on Accounting Engine.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}