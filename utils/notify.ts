import { withDb } from "../backend/db.server.ts";

/**
 * Sends a notification to a customer and saves it in the database.
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
    });
  } catch (err) {
    console.error("[notify] Failed to send notification:", err);
  }
}

export default notify;
