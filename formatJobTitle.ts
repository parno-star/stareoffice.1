// Format a job title (jabatan) into Title Case so it always displays as a
// mix of capital and lowercase letters, regardless of how it was typed
// (e.g. "KEPALA BAGIAN UMUM" -> "Kepala Bagian Umum").
//
// Common Indonesian connector words are kept lowercase, and short acronyms
// (all-caps tokens of 2-4 letters like "SDM", "TU", "IT") are preserved as-is
// because they are meaningful abbreviations, not words to be re-cased.

const LOWERCASE_WORDS = new Set([
  "dan",
  "atau",
  "di",
  "ke",
  "dari",
  "yang",
  "untuk",
  "pada",
  "dalam",
  "atas",
  "the",
  "of",
  "and",
]);

const isAcronym = (word: string): boolean =>
  /^[A-Z]{2,4}$/.test(word);

export function formatJobTitle(value: string | null | undefined): string {
  if (!value) return "";
  const words = value.trim().split(/\s+/);
  return words
    .map((word, index) => {
      if (isAcronym(word)) return word;
      const lower = word.toLowerCase();
      // Keep connector words lowercase unless they start the title.
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// Sentence case: only the very first letter of the whole title is capitalized,
// everything else is lowercase (e.g. "KEPALA BAGIAN UMUM" -> "Kepala bagian umum").
export function formatJobTitleSentence(value: string | null | undefined): string {
  if (!value) return "";
  const lower = value.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
