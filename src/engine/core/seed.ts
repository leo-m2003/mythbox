/** Plus grande graine possible (entier non signé sur 32 bits) */
export const MAX_SEED = 0xffffffff;

/**
 * Transforme ce que le joueur tape en graine.
 * - « 12345 » donne la graine 12345 ;
 * - un texte comme « olympe » est converti en nombre (hachage FNV-1a),
 *   toujours le même pour le même texte.
 * Renvoie null si le texte est vide.
 */
export function seedFromText(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    if (value <= MAX_SEED) return value;
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}