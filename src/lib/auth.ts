// Edge Runtime compatible auth utilities

export const COOKIE_NAME = "auth_session";
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// The session token is an HMAC of this fixed string using APP_PASSWORD as the key.
// Stateless: no server-side session storage needed.
const SESSION_DATA = "task-assistant-session";

export async function computeSessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_DATA)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateSessionCookie(
  cookieValue: string | undefined
): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password || !cookieValue) return false;
  const expected = await computeSessionToken(password);
  return cookieValue === expected;
}

export function validateApiKey(keyValue: string | undefined): boolean {
  const secret = process.env.API_SECRET;
  if (!secret || !keyValue) return false;
  return keyValue === secret;
}
