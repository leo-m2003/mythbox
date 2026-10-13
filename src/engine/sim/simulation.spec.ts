import { describe, it, expect } from 'vitest';
import { Terrain } from '../world/terrain';
import { World } from '../world/world';
import { INITIAL_PEOPLE, Simulation } from './simulation';

/** Un petit monde plat de prairie, traversé par une rivière verticale en x = 16 et 17 */
function grassWorldWithRiver(): World {
  const world = new World(32, 32, 0, 0.38);
  world.elevation.fill(0.5);
  world.moisture.fill(0.3);
  for (let y = 0; y < 32; y++) {
    world.elevation[world.index(16, y)] = 0.3;
    world.elevation[world.index(17, y)] = 0.3;
  }
  world.refreshAllTerrain();
  return world;
}

/** Vrai si tous les habitants sont sur une tuile praticable */
function allOnLand(sim: Simulation): boolean {
  const p = sim.people;
  for (let i = 0; i < p.count; i++) {
    if (!sim.isWalkable(Math.floor(p.x[i]), Math.floor(p.y[i]))) return false;
  }
  return true;
}

describe('Simulation', () => {
  it('part bien d’un monde de prairie coupé par l’eau', () => {
    const world = grassWorldWithRiver();
    expect(world.getTerrain(5, 5)).toBe(Terrain.Grass);
    expect(world.getTerrain(16, 5)).toBe(Terrain.ShallowWater);
  });

  it('fait apparaître le groupe de départ sur la terre ferme', () => {
    const sim = new Simulation(grassWorldWithRiver(), 42);
    expect(sim.spawnInitialGroup()).toBe(INITIAL_PEOPLE);
    expect(sim.people.count).toBe(INITIAL_PEOPLE);
    expect(allOnLand(sim)).toBe(true);
  });

  it('ne fait apparaître personne sur une île sans prairie', () => {
    const world = new World(16, 16, 0, 0.38);
    world.elevation.fill(0.1);
    world.refreshAllTerrain();
    const sim = new Simulation(world, 42);
    expect(sim.spawnInitialGroup()).toBe(0);
  });

  it('fait marcher les habitants sans jamais entrer dans l’eau', () => {
    const sim = new Simulation(grassWorldWithRiver(), 7);
    sim.spawnInitialGroup();
    const startX = Array.from(sim.people.x.subarray(0, sim.people.count));

    for (let t = 0; t < 300; t++) {
      sim.tick();
      expect(allOnLand(sim)).toBe(true);
    }

    expect(sim.people.count).toBe(INITIAL_PEOPLE);
    const moved = startX.some((x, i) => x !== sim.people.x[i]);
    expect(moved).toBe(true);
  });

  it('donne exactement les mêmes trajets pour la même graine', () => {
    const a = new Simulation(grassWorldWithRiver(), 123);
    const b = new Simulation(grassWorldWithRiver(), 123);
    a.spawnInitialGroup();
    b.spawnInitialGroup();
    for (let t = 0; t < 200; t++) {
      a.tick();
      b.tick();
    }
    expect(a.people.x).toEqual(b.people.x);
    expect(a.people.y).toEqual(b.people.y);
  });

  it('noie un habitant dont la tuile devient de l’eau', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    sim.people.add(5, 5);
    sim.people.add(25, 25);

    const i = world.index(5, 5);
    world.elevation[i] = 0.3;
    world.refreshTerrain(i);
    sim.tick();

    expect(sim.people.count).toBe(1);
    expect(sim.people.x[0]).toBe(25.5);
  });
});