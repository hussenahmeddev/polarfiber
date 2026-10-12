import { withDb } from "../backend/db.server.ts";
import { sendEmail, sendOrderStatusEmail, sendQuoteStatusEmail, sendMessageNotificationEmail } from "../backend/email";

/**
 * Sends a notification to a customer and saves it in the database.
 * Also sends email for important notification types.
 * Never throws an error or crashes the calling request.
 *
 * @param {number} userId
 * @param {string} type
 * @param {string} title
 * @param {string} body
 * @param {string} [linkUrl]
 */
export async function notify(
  userId: number | null | undefined,
  type: string,
  title: string,
  body: string,
  linkUrl: string | null = null,
): Promise<void> {
  try {
    if (!userId) return;
    await withDb(async (c) => {
      await c.execute(
        "INSERT INTO notifications (user_id, type, title, body, link_url) VALUES (?, ?, ?, ?, ?)",
        [userId, String(type), String(title), String(body), linkUrl ? String(linkUrl) : null],
      );

      // Get user email for email notifications
      const [user] = await c.execute(
        "SELECT email, name FROM users WHERE user_id = ?",
        [userId],
      );

      if (user && user.email) {
        // Send email notifications for important types (fire-and-forget)
        sendEmailByType(user.email, user.name, type, title, body, linkUrl).catch((err) => {
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
