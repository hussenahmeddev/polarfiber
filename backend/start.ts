import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./error-page";

const securityMiddleware = createMiddleware().server(async ({ next }) => {
  const res = await next();
  if (res instanceof Response) {
    res.headers.set("x-content-type-options", "nosniff");
    res.headers.set("x-frame-options", "DENY");
    res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    const origin = process.env["FRONTEND_ORIGIN"];
    if (origin) {
      res.headers.set("access-control-allow-origin", origin);
    }
  }
  return res;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware, errorMiddleware, csrfMiddleware],
}));
