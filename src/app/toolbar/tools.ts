import { BrushKind } from '@engine/world/brushes';

export interface ToolDef {
  /** Pinceau du moteur, ou null pour l'outil « main » */
  id: BrushKind | null;
  label: string;
  /** Raccourci clavier, affiché en majuscule */
  key: string;
  hint: string;
}

export const TOOLS: readonly ToolDef[] = [
  { id: null, label: 'Main', key: 'H', hint: 'Déplacer la vue' },
  { id: BrushKind.Raise, label: 'Élever', key: 'E', hint: 'Soulever les terres et les montagnes' },
  { id: BrushKind.Lower, label: 'Creuser', key: 'C', hint: 'Creuser les vallées, les lacs et les mers' },
  { id: BrushKind.Forest, label: 'Forêt', key: 'F', hint: 'Faire pousser des arbres' },
  { id: BrushKind.Clear, label: 'Défricher', key: 'D', hint: 'Abattre les forêts' },
];