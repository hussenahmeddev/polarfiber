import { withDb } from "./db.server";
import { decryptSmtpPassword } from "../utils/crypto";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends an email using the configured SMTP settings.
 * Reads SMTP configuration from app_settings table.
 * Never throws an error - fails silently with console.error.
 * This function only runs on the server.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const settings = await withDb(async (c) => {
      const rows = await c.execute(
        "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_password_enc', 'smtp_from')",
      );
      return rows[0];
    });

    const config: Record<string, string> = {};
    for (const row of settings) {
      config[row.setting_key] = row.setting_value;
    }

    if (!config.smtp_host || !config.smtp_user || !config.smtp_password_enc || !config.smtp_from) {
      console.warn("[sendEmail] SMTP not configured, skipping email send");
      return false;
    }

    const password = decryptSmtpPassword(config.smtp_password_enc);
    if (!password) {
      console.error("[sendEmail] Failed to decrypt SMTP password");
      return false;
    }

    // nodemailer is only available on the server
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.default.createTransport({
      host: config.smtp_host,
      port: Number(config.smtp_port) || 587,
      secure: Number(config.smtp_port) === 465,
      auth: {
        user: config.smtp_user,
        pass: password,
      },
    });

    await transporter.sendMail({
      from: config.smtp_from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return true;
  } catch (err) {
    console.error("[sendEmail] Failed to send email:", err);
    return false;
  }
}

/**
 * Sends a notification email for order status changes.
 */
export async function sendOrderStatusEmail(
  userEmail: string,
  userName: string,
  orderId: number,
  newStatus: string,
  orderTotal: number,
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: `Order #${orderId} Status Update - Polar Fiber`,
    text: `Dear ${userName},\n\nYour order #${orderId} (ETB ${orderTotal.toLocaleString()}) status has been updated to: ${newStatus}.\n\nTrack your order at: https://polarfiber.com.et/account?tab=orders\n\nThank you for choosing Polar Fiber!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0ea5e9;">Order Status Update</h2>
        <p>Dear ${userName},</p>
        <p>Your order <strong>#${orderId}</strong> (ETB ${orderTotal.toLocaleString()}) status has been updated to:</p>
        <p style="font-size: 18px; font-weight: bold; color: #0ea5e9;">${newStatus}</p>
        <p><a href="https://polarfiber.com.et/account?tab=orders" style="color: #0ea5e9;">Track your order</a></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
      </div>
    `,
  });
}

/**
 * Sends a notification email for quote status changes.
 */
export async function sendQuoteStatusEmail(
  userEmail: string,
  userName: string,
  quoteId: number,
  newStatus: string,
  quotedAmount?: number,
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: `Quote #${quoteId} Update - Polar Fiber`,
    text: `Dear ${userName},\n\nYour quote request #${quoteId} status has been updated to: ${newStatus}.${quotedAmount ? ` Quoted amount: ETB ${quotedAmount.toLocaleString()}` : ""}\n\nView details at: https://polarfiber.com.et/account?tab=quotes\n\nThank you for choosing Polar Fiber!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0ea5e9;">Quote Request Update</h2>
        <p>Dear ${userName},</p>
        <p>Your quote request <strong>#${quoteId}</strong> status has been updated to:</p>
        <p style="font-size: 18px; font-weight: bold; color: #0ea5e9;">${newStatus}</p>
        ${quotedAmount ? `<p>Quoted amount: <strong>ETB ${quotedAmount.toLocaleString()}</strong></p>` : ""}
        <p><a href="https://polarfiber.com.et/account?tab=quotes" style="color: #0ea5e9;">View quote details</a></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
      </div>
    `,
  });
}

/**
 * Sends a notification email for new messages.
 */
export async function sendMessageNotificationEmail(
  userEmail: string,
  userName: string,
  subject: string,
  preview: string,
  conversationUrl: string,
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: `New Message: ${subject} - Polar Fiber`,
    text: `Dear ${userName},\n\nYou have a new message:\n${preview}\n\nView conversation: ${conversationUrl}\n\nThank you for choosing Polar Fiber!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0ea5e9;">New Message</h2>
        <p>Dear ${userName},</p>
        <p>You have a new message regarding:</p>
        <p style="font-weight: bold;">${subject}</p>
        <p style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">${preview}</p>
        <p><a href="${conversationUrl}" style="color: #0ea5e9;">View conversation</a></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
      </div>
    `,
  });
}

/**
 * Sends a welcome email for new staff accounts.
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  temporaryPassword: string,
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Welcome to Polar Fiber Team - Your Account Details",
    text: `Dear ${userName},\n\nWelcome to the Polar Fiber team! Your staff account has been created.\n\nYour temporary password: ${temporaryPassword}\n\nPlease log in at: https://polarfiber.com.et/admin\nYou will be prompted to change your password on first login.\n\nBest regards,\nPolar Fiber Administration`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0ea5e9;">Welcome to Polar Fiber Team!</h2>
        <p>Dear ${userName},</p>
        <p>Welcome to the Polar Fiber team! Your staff account has been created.</p>
        <p>Your temporary password:</p>
        <p style="background: #fef3c7; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 16px; font-weight: bold; color: #92400e;">${temporaryPassword}</p>
        <p>Please log in at: <a href="https://polarfiber.com.et/admin" style="color: #0ea5e9;">https://polarfiber.com.et/admin</a></p>
        <p>You will be prompted to change your password on first login.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #64748b; font-size: 14px;">Best regards,<br/>Polar Fiber Administration</p>
      </div>
    `,
  });
}

export default sendEmail;