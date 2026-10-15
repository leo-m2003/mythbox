import { HAND, PowerKind, type Tool } from '@engine/tool';
import { BrushKind } from '@engine/world/brushes';

export interface ToolDef {
  /** L'outil du moteur. Toujours le même objet : on peut comparer avec === */
  tool: Tool;
  label: string;
  /** Raccourci clavier, affiché en majuscule */
  key: string;
  hint: string;
}

function brush(kind: BrushKind): Tool {
  return { type: 'brush', brush: kind };
}

function power(kind: PowerKind): Tool {
  return { type: 'power', power: kind };
}

export const TOOLS: readonly ToolDef[] = [
  { tool: HAND, label: 'Main', key: 'H', hint: 'Déplacer la vue' },
  { tool: brush(BrushKind.Raise), label: 'Élever', key: 'E', hint: 'Soulever les terres et les montagnes' },
  { tool: brush(BrushKind.Lower), label: 'Creuser', key: 'C', hint: 'Creuser les vallées, les lacs et les mers' },
  { tool: brush(BrushKind.Forest), label: 'Forêt', key: 'F', hint: 'Faire pousser des arbres' },
  { tool: brush(BrushKind.Clear), label: 'Défricher', key: 'D', hint: 'Abattre les forêts' },
  { tool: power(PowerKind.Lightning), label: 'Foudre', key: 'Z', hint: 'La foudre de Zeus : foudroyer les mortels' },
  { tool: power(PowerKind.Fire), label: 'Incendie', key: 'I', hint: 'Embraser forêts et prairies : le feu se propage' },
  { tool: power(PowerKind.Rain), label: 'Pluie', key: 'P', hint: 'Maintenir le clic : éteint le feu et nourrit la terre' },
  { tool: power(PowerKind.Quake), label: 'Séisme', key: 'S', hint: 'Fendre la terre et secouer les mortels' },
];