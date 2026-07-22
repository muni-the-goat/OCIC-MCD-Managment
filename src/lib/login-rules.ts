// Rules shared by the login page, the login action, and the proxy. Keeping
// them in one place means a new caller cannot reintroduce a weaker check.

// Only office accounts may sign in.
export const ALLOWED_EMAIL_DOMAIN = "@ocic.com.kh";

export function isAllowedEmail(email: string) {
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

const CONTROL_CHARS = new RegExp("[\u0000-\u001F\u007F]", "g");

// A post-login destination is only safe if it is a same-origin absolute path.
// Rejects "//evil.com" and "/\evil.com" (browsers normalise \ to / in the
// authority position) as well as anything carrying a scheme. Control
// characters are stripped first so a smuggled tab or newline cannot make this
// test disagree with what the browser ultimately parses.
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.replace(CONTROL_CHARS, "");
  return /^\/(?![/\\])/.test(next) ? next : null;
}
