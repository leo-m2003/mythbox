import { beforeEach, describe, expect, it } from 'vitest';
import { applyBrush, BrushKind, type Brush } from './brushes';
import { Terrain } from './terrain';
import { World } from './world';

/** Un petit monde plat de prairie, pour des tests prévisibles */
function flatGrassWorld(): World {
  const world = new World(32, 32, 0, 0.38);
  world.elevation.fill(0.5);
  world.moisture.fill(0.3);
  world.refreshAllTerrain();
  return world;
}

function paint(world: World, kind: BrushKind, times: number, x = 16, y = 16): void {
  const brush: Brush = { kind, radius: 3, strength: 0.02 };
  for (let n = 0; n < times; n++) {
    applyBrush(world, brush, x, y);
  }
}

describe('applyBrush', () => {
  let world: World;

  beforeEach(() => {
    world = flatGrassWorld();
  });

  it('part bien d’un monde de prairie', () => {
    expect(world.getTerrain(16, 16)).toBe(Terrain.Grass);
  });

  it('élève progressivement la prairie jusqu’à la montagne', () => {
    paint(world, BrushKind.Raise, 2);
    expect(world.getTerrain(16, 16)).toBe(Terrain.Grass);

    paint(world, BrushKind.Raise, 20);
    expect(world.getTerrain(16, 16)).toBeGreaterThanOrEqual(Terrain.Mountain);
  });

  it('creuse la prairie jusqu’à faire apparaître de l’eau', () => {
    paint(world, BrushKind.Lower, 10);
    expect(world.getTerrain(16, 16)).toBeLessThanOrEqual(Terrain.ShallowWater);
  });

  it('agit plus fort au centre qu’au bord', () => {
    paint(world, BrushKind.Raise, 1);
    const center = world.elevation[world.index(16, 16)];
    const edge = world.elevation[world.index(19, 16)];
    expect(center).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(0.5);
  });

  it('ne touche pas les tuiles hors du rayon', () => {
    paint(world, BrushKind.Raise, 10);
    expect(world.elevation[world.index(20, 16)]).toBe(0.5);
    expect(world.elevation[world.index(19, 19)]).toBe(0.5);
  });

  it('garde l’altitude entre 0 et 1', () => {
    paint(world, BrushKind.Raise, 200);
    expect(world.elevation[world.index(16, 16)]).toBeLessThanOrEqual(1);

    paint(world, BrushKind.Lower, 400);
    expect(world.elevation[world.index(16, 16)]).toBeGreaterThanOrEqual(0);
  });

  it('plante une forêt puis la défriche', () => {
    paint(world, BrushKind.Forest, 10);
    expect(world.getTerrain(16, 16)).toBe(Terrain.Forest);

    paint(world, BrushKind.Clear, 10);
    expect(world.getTerrain(16, 16)).toBe(Terrain.Grass);
  });

  it('ne fait pas pousser de forêt en montagne', () => {
    paint(world, BrushKind.Raise, 25);
    paint(world, BrushKind.Forest, 10);
    expect(world.getTerrain(16, 16)).not.toBe(Terrain.Forest);
  });

  it('renvoie la zone modifiée, limitée aux bords du monde', () => {
    const brush: Brush = { kind: BrushKind.Raise, radius: 3, strength: 0.02 };
    expect(applyBrush(world, brush, 0, 0)).toEqual({ x0: 0, y0: 0, x1: 3, y1: 3 });
    expect(applyBrush(world, brush, 16, 16)).toEqual({ x0: 13, y0: 13, x1: 19, y1: 19 });
  });

  it('ne fait rien hors du monde', () => {
    const brush: Brush = { kind: BrushKind.Raise, radius: 3, strength: 0.02 };
    expect(applyBrush(world, brush, -10, -10)).toBeNull();
  });
});