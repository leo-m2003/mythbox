import { Terrain } from './terrain';

/** Humidité au-dessus de laquelle une prairie devient forêt */
export const FOREST_MOISTURE = 0.55;

/**
 * Hauteur à partir de laquelle les sommets sont enneigés toute l'année.
 * Une hauteur se mesure au-dessus de la mer, de 0 (le rivage) à 1 (le plus haut sommet possible).
 */
export const SNOW_HEIGHT = 0.55;

/** Altitude d'une tuile à la hauteur `height` au-dessus de la mer (l'inverse du h de terrainFor) */
export function elevationAt(height: number, seaLevel: number): number {
  return seaLevel + height * (1 - seaLevel);
}

/**
 * Choisit le terrain d'une tuile à partir de son altitude et de son humidité.
 * Utilisée par la génération ET par les pinceaux, pour rester cohérents.
 */
export function terrainFor(elevation: number, moisture: number, seaLevel: number): Terrain {
  if (elevation < seaLevel - 0.1) return Terrain.DeepWater;
  if (elevation < seaLevel) return Terrain.ShallowWater;

  // Hauteur au-dessus de la mer, ramenée entre 0 (rivage) et 1 (plus haut sommet)
  const h = (elevation - seaLevel) / (1 - seaLevel);

  if (h < 0.04) return Terrain.Sand;
  if (h < 0.3) return moisture > FOREST_MOISTURE ? Terrain.Forest : Terrain.Grass;
  if (h < 0.42) return Terrain.Hills;
  if (h < SNOW_HEIGHT) return Terrain.Mountain;
  return Terrain.Snow;
}