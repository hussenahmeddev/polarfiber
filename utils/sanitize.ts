export const MESSAGE_MAX_LENGTH = 2000;

// Strips C0 control characters except newline (0x0A) and tab (0x09),
// plus DEL (0x7F). Built from code points so the source stays plain ASCII.
function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (code === 0x0a || code === 0x09) {
      out += ch;
      continue;
    }
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out;
}

/**
 * Normalises a user-supplied message for safe storage and display.
 * React escapes on render, so the goals here are shape and hygiene:
 * consistent newlines, no control characters, no runaway blank space.
 * Returns "" for non-string input so callers can treat it as "empty".
 */
export function sanitizeMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return stripControlChars(raw.replace(/\r\n?/g, "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A message must be non-empty (ignoring whitespace) and within the limit. */
export function isMessageLengthValid(body: string): boolean {
  const s = body.trim();
  return s.length > 0 && s.length <= MESSAGE_MAX_LENGTH;
}

/** Collapses whitespace for use as a notification preview. */
export function preview(body: string, max = 300): string {
  const clean = sanitizeMessage(body).replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3))}...`;
}
