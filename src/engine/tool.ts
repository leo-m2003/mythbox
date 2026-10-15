import { BrushKind } from './world/brushes';

/** Les pouvoirs divins : un clic, un effet immédiat (contrairement aux pinceaux, qui agissent en continu) */
export enum PowerKind {
  /** La foudre de Zeus : foudroie les mortels sous le point d'impact */
  Lightning,
  /** L'incendie : met le feu à la végétation, qui se propage de proche en proche */
  Fire,
  /** La pluie : tant qu'on maintient le clic, elle éteint le feu et nourrit la terre */
  Rain,
  /** Le séisme de Poséidon, « l'ébranleur de la terre » : ouvre une faille et secoue les mortels */
  Quake,
}

/**
 * L'outil tenu par le dieu. Une union « discriminée » : le champ `type` dit de quel cas il s'agit,
 * et TypeScript sait alors quels autres champs existent (`brush` ou `power`).
 */
export type Tool =
  | { readonly type: 'hand' }
  | { readonly type: 'brush'; readonly brush: BrushKind }
  | { readonly type: 'power'; readonly power: PowerKind };

/** L'outil « main » : déplacer la vue */
export const HAND: Tool = { type: 'hand' };