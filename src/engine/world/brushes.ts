import { World } from './world';

export enum BrushKind {
  /** Élève le terrain : l'eau devient terre, la terre devient montagne */
  Raise,
  /** Creuse le terrain : la montagne s'abaisse, la terre devient eau */
  Lower,
  /** Humidifie le sol : la prairie devient forêt */
  Forest,
  /** Assèche le sol : la forêt redevient prairie */
  Clear,
}

export interface Brush {
  kind: BrushKind;
  /** Rayon en tuiles (1 = une seule tuile et ses voisines immédiates) */
  radius: number;
  /** Intensité d'une application (le pinceau s'applique en continu) */
  strength: number;
}

/** Zone rectangulaire de tuiles, bornes incluses */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const FOREST_TARGET = 0.8;
const CLEAR_TARGET = 0.2;

/**
 * Applique un pinceau centré sur une tuile.
 * L'effet est maximal au centre et s'atténue vers le bord du cercle.
 * Renvoie la zone modifiée (pour redessiner seulement cette partie),
 * ou null si le pinceau est entièrement hors du monde.
 */
export function applyBrush(
  world: World,
  brush: Brush,
  centerX: number,
  centerY: number,
): TileRect | null {
  const r = Math.max(1, Math.floor(brush.radius));

  const x0 = Math.max(0, centerX - r);
  const y0 = Math.max(0, centerY - r);
  const x1 = Math.min(world.width - 1, centerX + r);
  const y1 = Math.min(world.height - 1, centerY + r);
  if (x0 > x1 || y0 > y1) return null;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance > r) continue;

      // 1 au centre, proche de 0 au bord du cercle
      const falloff = 1 - (distance / (r + 0.5)) ** 2;
      const amount = brush.strength * falloff;
      const i = world.index(x, y);

      switch (brush.kind) {
        case BrushKind.Raise:
          world.elevation[i] = Math.min(1, world.elevation[i] + amount);
          break;
        case BrushKind.Lower:
          world.elevation[i] = Math.max(0, world.elevation[i] - amount);
          break;
        case BrushKind.Forest:
          world.moisture[i] += (FOREST_TARGET - world.moisture[i]) * Math.min(1, amount * 10);
          break;
        case BrushKind.Clear:
          world.moisture[i] += (CLEAR_TARGET - world.moisture[i]) * Math.min(1, amount * 10);
          break;
      }

      world.refreshTerrain(i);
    }
  }

  return { x0, y0, x1, y1 };
}