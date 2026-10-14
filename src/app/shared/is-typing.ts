/** Vrai si le joueur est en train d'écrire dans un champ de texte */
export function isTyping(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return target.type !== 'range';
  return target instanceof HTMLElement && target.isContentEditable;
}