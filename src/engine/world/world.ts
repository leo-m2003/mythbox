import { Terrain } from './terrain';

/**
 * La carte du monde : une grille de tuiles stockée à plat dans des tableaux typés.
 * La tuile (x, y) se trouve à l'index y * width + x.
 */
export class World {
  /** Type de terrain de chaque tuile */
  readonly terrain: Uint8Array;
  /** Altitude de chaque tuile, de 0 (abysses) à 1 (sommets) */
  readonly elevation: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly seed: number,
  ) {
    this.terrain = new Uint8Array(width * height);
    this.elevation = new Float32Array(width * height);
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

  setTerrain(x: number, y: number, terrain: Terrain): void {
    this.terrain[this.index(x, y)] = terrain;
  }
}