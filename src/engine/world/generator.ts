import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { Random } from '../core/random';
import { World } from './world';

export interface WorldGenOptions {
  width: number;
  height: number;
  seed: number;
  /** Zoom du bruit : plus la valeur est petite, plus les îles sont grandes */
  scale?: number;
  /** Niveau de la mer entre 0 et 1 : plus il est haut, plus il y a d'eau */
  seaLevel?: number;
}

/**
 * Superpose plusieurs couches de bruit (octaves).
 * Chaque couche est deux fois plus fine et deux fois moins forte que la précédente.
 * Renvoie une valeur entre -1 et 1.
 */
function fractalNoise(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

export function generateWorld(options: WorldGenOptions): World {
  const { width, height, seed, scale = 0.012, seaLevel = 0.38 } = options;

  const world = new World(width, height, seed, seaLevel);
  const rng = new Random(seed);

  // Deux bruits indépendants, tous deux dérivés de la graine
  const elevationNoise = createNoise2D(() => rng.next());
  const moistureNoise = createNoise2D(() => rng.next());

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 1. Relief brut, ramené entre 0 et 1
      let elevation = (fractalNoise(elevationNoise, x * scale, y * scale, 5) + 1) / 2;

      // 2. Masque d'île : 0 au centre, 1 sur les bords
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;
      const edge = 1 - (1 - nx * nx) * (1 - ny * ny);
      elevation *= 1 - edge * edge;

      // 3. Humidité, avec un motif un peu plus fin que le relief
      const moisture =
        (fractalNoise(moistureNoise, x * scale * 1.5, y * scale * 1.5, 3) + 1) / 2;

      const i = world.index(x, y);
      world.elevation[i] = elevation;
      world.moisture[i] = moisture;
      world.refreshTerrain(i);
    }
  }

  return world;
}