import { consumeLastCapturedError } from "./error-capture";
import { renderErrorPage } from "./error-page";
import { parseUserIdFromCookieHeader, loadUser } from "./session.server";
import { getPermissionsForRole } from "../shared/permissions";
import { withDb } from "./db.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function serveProductImage(productId: number): Promise<Response> {
  try {
    const [rows] = await withDb((c) =>
      c.execute(
        "SELECT image_data, mime_type FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1",
        [productId],
      ),
    );
    if (!rows[0]) {
      return new Response("Image not found", { status: 404 });
    }
    return new Response(rows[0].image_data, {
      status: 200,
      headers: {
        "content-type": rows[0].mime_type,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    
    // Serve product images from database
    if (url.pathname.startsWith("/api/images/") && request.method === "GET") {
      const productId = parseInt(url.pathname.split("/api/images/")[1], 10);
      if (!isNaN(productId)) {
        return await serveProductImage(productId);
      }
      return new Response("Invalid product ID", { status: 400 });
    }

    if (url.pathname === "/api/auth/permissions" && request.method === "GET") {
      try {
        const uid = parseUserIdFromCookieHeader(request.headers.get("cookie"));
        if (!uid) {
          return new Response(JSON.stringify({ role: "customer", permissions: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        const u = await loadUser(uid);
        if (!u || u.must_change_password) {
          return new Response(JSON.stringify({ role: u?.role ?? "customer", permissions: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            role: u.role,
            permissions: getPermissionsForRole(u.role),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      } catch {
        return new Response(JSON.stringify({ role: "customer", permissions: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
