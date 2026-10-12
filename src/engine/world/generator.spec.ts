import { describe, it, expect } from 'vitest';
import { generateWorld } from './generator';
import { Terrain } from './terrain';

const W = 256;
const H = 192;

describe('generateWorld', () => {
  it('génère exactement le même monde pour la même graine', () => {
    const a = generateWorld({ width: W, height: H, seed: 42 });
    const b = generateWorld({ width: W, height: H, seed: 42 });
    expect(a.terrain).toEqual(b.terrain);
  });

  it('génère des mondes différents pour des graines différentes', () => {
    const a = generateWorld({ width: W, height: H, seed: 1 });
    const b = generateWorld({ width: W, height: H, seed: 2 });
    expect(a.terrain).not.toEqual(b.terrain);
  });

  it("entoure toujours l'île d'eau", () => {
    for (const seed of [1, 42, 12345, 987654]) {
      const world = generateWorld({ width: W, height: H, seed });
      for (let x = 0; x < W; x++) {
        expect(world.getTerrain(x, 0)).toBeLessThanOrEqual(Terrain.ShallowWater);
        expect(world.getTerrain(x, H - 1)).toBeLessThanOrEqual(Terrain.ShallowWater);
      }
      for (let y = 0; y < H; y++) {
        expect(world.getTerrain(0, y)).toBeLessThanOrEqual(Terrain.ShallowWater);
        expect(world.getTerrain(W - 1, y)).toBeLessThanOrEqual(Terrain.ShallowWater);
      }
    }
  });

  it('contient une quantité raisonnable de terres', () => {
    const world = generateWorld({ width: W, height: H, seed: 42 });
    let land = 0;
    for (const t of world.terrain) {
      if (t > Terrain.ShallowWater) land++;
    }
    const ratio = land / world.size;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.6);
  });
});