import { Terrain } from './terrain';
import { terrainFor } from './terrain-rules';

/**
 * La carte du monde : une grille de tuiles stockée à plat dans des tableaux typés.
 * La tuile (x, y) se trouve à l'index y * width + x.
 *
 * Le terrain n'est jamais modifié directement : il découle toujours
 * de l'altitude et de l'humidité (voir refreshTerrain).
 */
export class World {
  /** Type de terrain de chaque tuile */
  readonly terrain: Uint8Array;
  /** Altitude de chaque tuile, de 0 (abysses) à 1 (sommets) */
  readonly elevation: Float32Array;
  /** Humidité de chaque tuile, de 0 (aride) à 1 (détrempé) */
  readonly moisture: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly seed: number,
    readonly seaLevel: number,
  ) {
    this.terrain = new Uint8Array(width * height);
    this.elevation = new Float32Array(width * height);
    this.moisture = new Float32Array(width * height);
  }

  get size(): number {
    return this.width * this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getTerrain(x: number, y: number): Terrain {
    return this.terrain[this.index(x, y)] as Terrain;
  }

  /** Recalcule le terrain d'une tuile à partir de son altitude et de son humidité */
  refreshTerrain(i: number): void {
    this.terrain[i] = terrainFor(this.elevation[i], this.moisture[i], this.seaLevel);
  }

  /** Recalcule le terrain de toutes les tuiles */
  refreshAllTerrain(): void {
    for (let i = 0; i < this.size; i++) {
      this.refreshTerrain(i);
    }
  }
}