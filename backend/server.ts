import { consumeLastCapturedError } from "./error-capture";
import { renderErrorPage } from "./error-page";
import { parseUserIdFromCookieHeader, loadUser } from "./session.server";
import { getPermissionsForRole } from "../shared/permissions";

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
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
          return new Response(
            JSON.stringify({ role: u?.role ?? "customer", permissions: [] }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
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
