import { withDb } from "../backend/db.server.ts";
import {
  sendEmail,
  sendOrderStatusEmail,
  sendQuoteStatusEmail,
  sendMessageNotificationEmail,
} from "../backend/email";

/**
 * Sends a notification to a customer and saves it in the database.
 * Also sends email for important notification types.
 * Never throws an error or crashes the calling request.
 *
 * Pass `options.dedupeKey` to make the notification idempotent: a repeated
 * request (retry, double submit, browser refresh) with the same key inserts
 * nothing and sends no email, because the insert is an INSERT IGNORE against
 * the UNIQUE dedupe_key column.
 *
 * @param {number} userId
 * @param {string} type
 * @param {string} title
 * @param {string} body
 * @param {string} [linkUrl]
 * @param {{ dedupeKey?: string | null }} [options]
 */
export async function notify(
  userId: number | null | undefined,
  type: string,
  title: string,
  body: string,
  linkUrl: string | null = null,
  options?: { dedupeKey?: string | null },
): Promise<void> {
  try {
    if (!userId) return;
    const dedupeKey = options?.dedupeKey ? String(options.dedupeKey) : null;
    await withDb(async (c) => {
      const [res] = await c.execute(
        dedupeKey
          ? "INSERT IGNORE INTO notifications (user_id, type, title, body, link_url, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)"
          : "INSERT INTO notifications (user_id, type, title, body, link_url) VALUES (?, ?, ?, ?, ?)",
        dedupeKey
          ? [
              userId,
              String(type),
              String(title),
              String(body),
              linkUrl ? String(linkUrl) : null,
              dedupeKey,
            ]
          : [userId, String(type), String(title), String(body), linkUrl ? String(linkUrl) : null],
      );

      // affectedRows === 0 means the dedupe key already existed: the
      // notification was already delivered, so skip the email too.
      if (dedupeKey && Number((res as { affectedRows?: number }).affectedRows ?? 1) === 0) return;

      // Get user email for email notifications
      // NOTE: c.execute() resolves to [rows, fieldPackets] — destructure the
      // rows first. The old code read `user.email` off the rows array, which
      // was always undefined, so emails were silently never sent.
      const [userRows] = await c.execute("SELECT email, name FROM users WHERE user_id = ?", [
        userId,
      ]);
      const user = (userRows as Array<{ email?: string; name?: string }>)[0];
      const email = user?.email;
      const name = user?.name ?? "";

      if (email) {
        // Send email notifications for important types (fire-and-forget)
        sendEmailByType(email, name, type, title, body, linkUrl).catch((err) => {
          console.error("[notify] Email send failed:", err);
        });
      }
    });
  } catch (err) {
    console.error("[notify] Failed to send notification:", err);
  }
}

async function sendEmailByType(
  email: string,
  name: string,
  type: string,
  title: string,
  body: string,
  linkUrl: string | null,
): Promise<void> {
  try {
    switch (type) {
      case "order_status":
      case "order_created":
      case "order_paid":
        // Extract order ID from title or link
        const orderMatch = title.match(/Order #(\d+)/);
        if (orderMatch) {
          const orderId = Number(orderMatch[1]);
          // Extract total from body if possible
          const totalMatch = body.match(/ETB ([\d,]+)/);
          const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0;
          const statusMatch = title.match(/Order #\d+ (\w+(?: \w+)?)/);
          const status = statusMatch ? statusMatch[1] : "Updated";
          await sendOrderStatusEmail(email, name, orderId, status, total);
        }
        break;

      case "quote_status":
        const quoteMatch = title.match(/Quote Request #(\d+)/);
        if (quoteMatch) {
          const quoteId = Number(quoteMatch[1]);
          const amountMatch = body.match(/ETB ([\d,]+)/);
          const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;
          const statusMatch = title.match(/Quote Request #\d+ (\w+(?: \w+)?)/);
          const status = statusMatch ? statusMatch[1] : "Updated";
          await sendQuoteStatusEmail(email, name, quoteId, status, amount);
        }
        break;

      case "customer_message":
      case "message_reply":
      case "ticket_reply":
      case "ticket_status":
        await sendMessageNotificationEmail(email, name, title, body, linkUrl ?? "");
        break;

      case "welcome":
        // Welcome emails are sent separately with temporary password
        break;

      default:
        // For other types, send a generic notification email
        await sendEmail({
          to: email,
          subject: `Polar Fiber: ${title}`,
          text: `Dear ${name},\n\n${body}\n\n${linkUrl ? `View details: ${linkUrl}\n` : ""}Thank you for choosing Polar Fiber!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #0ea5e9;">${title}</h2>
              <p>Dear ${name},</p>
              <p>${body}</p>
              ${linkUrl ? `<p><a href="${linkUrl}" style="color: #0ea5e9;">View details</a></p>` : ""}
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
              <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
            </div>
          `,
        });
    }
  } catch (err) {
    console.error("[notify] Email by type failed:", err);
  }
}

export default notify;
