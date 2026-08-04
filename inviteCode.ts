/**
 * Invite-code utilities for organization onboarding.
 *
 * Codes are short, uppercase, and avoid ambiguous characters (0/O, 1/I/L)
 * so they are easy to read aloud and type. Uniqueness is enforced by the
 * caller against the `by_invite_code` index.
 */

// Unambiguous alphabet: no 0, O, 1, I, L
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Generates a random invite code like "MAJ7KP". */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Normalizes user-entered codes: trim, uppercase, strip non-alphanumerics. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
