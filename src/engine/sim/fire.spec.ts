import { describe, it, expect } from 'vitest';
import { Random } from '../core/random';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { World } from '../world/world';
import { Fire, SCORCH_TICKS } from './fire';

/**
 * Une île de sable plat (qui ne brûle pas), avec une bande horizontale de forêt
 * sur la ligne y = 5, de x = 2 à x = 2 + length - 1. length = 0 : pas de forêt.
 */
function sandWorldWithForest(length: number): World {
  const world = new World(32, 32, 0, 0.38);
  // 0,39 : juste au-dessus de la mer, donc plage
  world.elevation.fill(0.39);
  world.moisture.fill(0.3);
  for (let x = 2; x < 2 + length; x++) {
    world.elevation[world.index(x, 5)] = 0.5;
    world.moisture[world.index(x, 5)] = 0.8;
  }
  world.refreshAllTerrain();
  return world;
}

/** Fait brûler `ticks` pas, et renvoie les tuiles qui ont fini de brûler, dans l'ordre */
function run(fire: Fire, random: Random, ticks: number): number[] {
  const burnedOut: number[] = [];
  for (let t = 0; t < ticks; t++) {
    fire.tick(random, (i) => burnedOut.push(i));
  }
  return burnedOut;
}

describe('Fire', () => {
  it('enflamme la végétation, mais ni le sable ni l’eau', () => {
    const world = sandWorldWithForest(1);
    world.elevation[world.index(20, 20)] = 0.2;
    world.refreshAllTerrain();
    const fire = new Fire(world);

    expect(world.getTerrain(2, 5)).toBe(Terrain.Forest);
    expect(world.getTerrain(20, 20)).toBe(Terrain.DeepWater);
    expect(fire.ignite(world.index(2, 5))).toBe(true);
    expect(fire.ignite(world.index(10, 10))).toBe(false);
    expect(fire.ignite(world.index(20, 20))).toBe(false);
    expect(fire.count).toBe(1);
  });

  it('ne rallume pas une tuile déjà en feu', () => {
    const world = sandWorldWithForest(1);
    const fire = new Fire(world);
    fire.ignite(world.index(2, 5));

    expect(fire.ignite(world.index(2, 5))).toBe(false);
    expect(fire.count).toBe(1);
  });

  it('se consume en burnTicks pas, puis laisse la terre brûlée pendant SCORCH_TICKS pas', () => {
    const world = sandWorldWithForest(1);
    const fire = new Fire(world);
    const random = new Random(1);
    const tile = world.index(2, 5);
    const burnTicks = TERRAIN_INFO[Terrain.Forest].burnTicks;
    fire.ignite(tile);

    expect(run(fire, random, burnTicks - 1)).toEqual([]);
    expect(fire.count).toBe(1);

    expect(run(fire, random, 1)).toEqual([tile]);
    expect(fire.count).toBe(0);
    expect(fire.scorched[tile]).toBe(SCORCH_TICKS);
    expect(fire.scorchedCount).toBe(1);
    // Il n'y a plus rien à brûler
    expect(fire.ignite(tile)).toBe(false);

    run(fire, random, SCORCH_TICKS);
    expect(fire.scorchedCount).toBe(0);
    expect(fire.ignite(tile)).toBe(true);
  });

  it('se propage le long d’une bande de forêt, sans toucher au sable', () => {
    const world = sandWorldWithForest(10);
    const fire = new Fire(world);
    fire.ignite(world.index(2, 5));

    const burnedOut = run(fire, new Random(1), 2000);

    // Toute la bande a brûlé, et rien d'autre
    expect(burnedOut.length).toBe(10);
    expect(new Set(burnedOut)).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => world.index(x, 5))));
    expect(fire.count).toBe(0);
  });

  it('s’éteint sans laisser de terre brûlée quand la tuile est noyée', () => {
    const world = sandWorldWithForest(1);
    const fire = new Fire(world);
    const tile = world.index(2, 5);
    fire.ignite(tile);

    world.elevation[tile] = 0.2;
    world.refreshTerrain(tile);
    const burnedOut = run(fire, new Random(1), 1);

    expect(burnedOut).toEqual([]);
    expect(fire.count).toBe(0);
    expect(fire.scorchedCount).toBe(0);
  });
});