import { describe, it, expect } from 'vitest';
import { Terrain } from '../world/terrain';
import { World } from '../world/world';
import { TICKS_PER_YEAR } from './sim-clock';
import {
  ADULT_AGE,
  BIRTH_COOLDOWN,
  BIRTH_HUNGER,
  FERTILE_UNTIL,
  FIRE_RADIUS,
  FOOD_REGROWTH,
  HUNGRY_AT,
  INITIAL_PEOPLE,
  LIGHTNING_RADIUS,
  MAX_VILLAGE_SIZE,
  MIN_FOUNDERS,
  PORTION_VALUE,
  Simulation,
  STARVATION,
  WANDER_RADIUS,
} from './simulation';

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

/** Une île de sable plat (aucune nourriture), avec éventuellement une tuile de prairie */
function sandWorld(grassX?: number, grassY?: number): World {
  const world = new World(32, 32, 0, 0.38);
  // 0,39 : juste au-dessus de la mer, donc plage
  world.elevation.fill(0.39);
  world.moisture.fill(0.3);
  if (grassX !== undefined && grassY !== undefined) {
    world.elevation[world.index(grassX, grassY)] = 0.5;
  }
  world.refreshAllTerrain();
  return world;
}

/** Ajoute un adulte de 20 ans, rassasié et quasi immortel, sur la tuile (x, y) */
function addAdult(sim: Simulation, x: number, y: number): number {
  const i = sim.people.add(x, y);
  sim.people.age[i] = 20 * TICKS_PER_YEAR;
  return i;
}

/** Fait tourner la simulation jusqu'à ce que la condition soit vraie (au plus `max` pas). Renvoie le nombre de pas */
function runUntil(sim: Simulation, condition: () => boolean, max = 2000): number {
  let t = 0;
  while (!condition() && t < max) {
    sim.tick();
    t++;
  }
  return t;
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

    // Des enfants ont pu naître entre-temps : ils sont ajoutés à la fin, les premiers numéros ne bougent pas
    expect(sim.people.count).toBeGreaterThanOrEqual(INITIAL_PEOPLE);
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

  it('remplit chaque tuile de nourriture selon son terrain', () => {
    const world = sandWorld(10, 5);
    const sim = new Simulation(world, 1);
    expect(world.getTerrain(3, 3)).toBe(Terrain.Sand);
    expect(sim.food[world.index(3, 3)]).toBe(0);
    expect(world.getTerrain(10, 5)).toBe(Terrain.Grass);
    expect(sim.food[world.index(10, 5)]).toBe(2);
  });

  it('meurt de faim au bout de STARVATION pas sans manger', () => {
    const sim = new Simulation(sandWorld(), 1);
    sim.people.add(5, 5);

    for (let t = 0; t < STARVATION - 1; t++) {
      sim.tick();
    }
    expect(sim.people.count).toBe(1);
    expect(sim.people.hunger[0]).toBe(STARVATION - 1);

    sim.tick();
    expect(sim.people.count).toBe(0);
  });

  it('ne mange pas quand il n’a pas faim', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    sim.people.add(5, 5);
    sim.tick();
    expect(sim.food[world.index(5, 5)]).toBe(2);
    expect(sim.people.hunger[0]).toBe(1);
  });

  it('mange une portion sur sa tuile quand il a faim', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    sim.people.add(5, 5);
    sim.people.hunger[0] = HUNGRY_AT;

    sim.tick();

    // La faim monte d'abord à HUNGRY_AT + 1, puis le repas retire PORTION_VALUE
    expect(sim.people.hunger[0]).toBe(HUNGRY_AT + 1 - PORTION_VALUE);
    expect(sim.food[world.index(5, 5)]).toBe(1);
  });

  it('marche jusqu’à la nourriture la plus proche quand il a faim', () => {
    const world = sandWorld(10, 5);
    const sim = new Simulation(world, 1);
    sim.people.add(5, 5);
    sim.people.hunger[0] = HUNGRY_AT;

    // 5 tuiles à 0,15 tuile par pas : environ 34 pas de marche, puis le repas
    for (let t = 0; t < 60; t++) {
      sim.tick();
    }

    // Une portion mangée (la tuile a un peu repoussé depuis le repas)
    expect(sim.food[world.index(10, 5)]).toBeLessThan(1.5);
    expect(sim.people.count).toBe(1);
    expect(sim.people.hunger[0]).toBeLessThan(HUNGRY_AT);
  });

  it('fait repousser la nourriture sans dépasser la capacité du terrain', () => {
    const world = sandWorld(10, 5);
    const sim = new Simulation(world, 1);
    const tile = world.index(10, 5);
    sim.food[tile] = 0;

    for (let t = 0; t < 1 / FOOD_REGROWTH; t++) {
      sim.tick();
    }
    expect(sim.food[tile]).toBeCloseTo(1, 3);

    for (let t = 0; t < 2 / FOOD_REGROWTH; t++) {
      sim.tick();
    }
    expect(sim.food[tile]).toBe(2);
  });

  it('fait apparaître un groupe d’adultes de 16 à 30 ans', () => {
    const sim = new Simulation(grassWorldWithRiver(), 42);
    sim.spawnInitialGroup();
    for (let i = 0; i < sim.people.count; i++) {
      expect(sim.people.age[i]).toBeGreaterThanOrEqual(ADULT_AGE);
      expect(sim.people.age[i]).toBeLessThanOrEqual(30 * TICKS_PER_YEAR);
      expect(sim.isFertile(i)).toBe(true);
    }
  });

  it('vieillit d’un pas à chaque pas et meurt de vieillesse', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    sim.people.add(5, 5, 10);

    for (let t = 0; t < 9; t++) {
      sim.tick();
    }
    expect(sim.people.count).toBe(1);
    expect(sim.people.age[0]).toBe(9);

    sim.tick();
    expect(sim.people.count).toBe(0);
  });

  it('fait naître un enfant quand deux adultes rassasiés sont proches', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    addAdult(sim, 5, 5);
    addAdult(sim, 6, 5);

    // Chacun a 1 chance sur 120 par pas : en 1000 pas, une naissance est quasi certaine
    let t = 0;
    while (sim.people.count === 2 && t < 1000) {
      sim.tick();
      t++;
    }

    expect(sim.people.count).toBe(3);
    // Le nouveau-né est le dernier, il n'a pas encore vieilli
    expect(sim.people.age[2]).toBe(0);
    expect(sim.people.hunger[2]).toBe(0);
    // Le parent attend avant le prochain enfant, et a un peu plus faim
    const parent = sim.people.birthCooldown[0] > 0 ? 0 : 1;
    expect(sim.people.birthCooldown[parent]).toBe(BIRTH_COOLDOWN);
    expect(sim.people.hunger[parent]).toBeGreaterThanOrEqual(BIRTH_HUNGER);
  });

  it('ne fait pas naître d’enfant à un adulte seul', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    addAdult(sim, 5, 5);
    for (let t = 0; t < 1000; t++) {
      sim.tick();
    }
    expect(sim.people.count).toBe(1);
  });

  it('ne fait pas naître d’enfant à des enfants ni à des personnes trop âgées', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    sim.people.add(5, 5);
    sim.people.add(6, 5);
    const elder = addAdult(sim, 25, 5);
    const elder2 = addAdult(sim, 26, 5);
    sim.people.age[elder] = FERTILE_UNTIL;
    sim.people.age[elder2] = FERTILE_UNTIL;

    for (let t = 0; t < 1000; t++) {
      sim.tick();
    }
    expect(sim.people.count).toBe(4);
  });

  it('fonde un village quand assez d’adultes sans village sont réunis', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    for (let n = 0; n < MIN_FOUNDERS; n++) {
      addAdult(sim, 5 + n, 5);
    }

    runUntil(sim, () => sim.villages.count > 0);

    expect(sim.villages.count).toBe(1);
    // Des enfants ont pu naître avant la fondation : ils rejoignent le village avec les adultes
    expect(sim.villages.population[0]).toBe(sim.people.count);
    for (let i = 0; i < sim.people.count; i++) {
      expect(sim.people.village[i]).toBe(0);
    }
  });

  it('ne fonde pas de village avec trop peu d’adultes', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    for (let n = 0; n < MIN_FOUNDERS - 1; n++) {
      addAdult(sim, 5 + n, 5);
    }
    runUntil(sim, () => sim.villages.count > 0, 1000);
    expect(sim.villages.count).toBe(0);
  });

  it('fait rejoindre un village proche plutôt que d’en fonder un autre', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(8, 8);
    const settler = addAdult(sim, 8, 8);
    sim.people.village[settler] = v;
    sim.villages.join(v);

    // Assez de monde pour fonder, mais trop près du village existant
    for (let n = 0; n < MIN_FOUNDERS; n++) {
      addAdult(sim, 6 + n, 10);
    }
    runUntil(sim, () => sim.villages.population[v] === MIN_FOUNDERS + 1);

    expect(sim.villages.count).toBe(1);
    expect(sim.villages.population[v]).toBe(MIN_FOUNDERS + 1);
  });

  it('n’accueille plus personne dans un village plein', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(8, 8);
    // On gonfle le compteur : MAX_VILLAGE_SIZE habitants « absents » de la carte
    sim.villages.population[v] = MAX_VILLAGE_SIZE;
    const newcomer = addAdult(sim, 8, 8);

    for (let t = 0; t < 1000; t++) {
      sim.tick();
    }
    expect(sim.people.village[newcomer]).toBe(-1);
  });

  it('fait partir un adulte d’un village trop peuplé', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(8, 8);
    const i = addAdult(sim, 8, 8);
    sim.people.village[i] = v;
    // Lui, plus MAX_VILLAGE_SIZE habitants « absents » de la carte : le village est trop peuplé
    sim.villages.population[v] = MAX_VILLAGE_SIZE + 1;

    // 1 chance sur 120 par pas : en 2000 pas, le départ est quasi certain
    runUntil(sim, () => sim.people.village[i] < 0);

    expect(sim.people.village[i]).toBe(-1);
    expect(sim.villages.population[v]).toBe(MAX_VILLAGE_SIZE);
  });

  it('ne rejoint pas de village tant qu’il a faim', () => {
    // Une plage sans nourriture : il reste affamé
    const sim = new Simulation(sandWorld(), 1);
    const v = sim.villages.found(8, 8);
    const settler = addAdult(sim, 8, 8);
    sim.people.village[settler] = v;
    sim.villages.join(v);

    const newcomer = addAdult(sim, 9, 8);
    sim.people.hunger[newcomer] = HUNGRY_AT;
    for (let t = 0; t < 150; t++) {
      sim.tick();
    }
    expect(sim.people.village[newcomer]).toBe(-1);
  });

  it('fait naître les enfants dans le village de leur parent', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(5, 5);
    for (const x of [5, 6]) {
      const i = addAdult(sim, x, 5);
      sim.people.village[i] = v;
      sim.villages.join(v);
    }

    runUntil(sim, () => sim.people.count === 3);

    expect(sim.people.count).toBe(3);
    expect(sim.people.village[2]).toBe(v);
    expect(sim.villages.population[v]).toBe(3);
  });

  it('garde les villageois autour de leur village', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(8, 8);
    const i = addAdult(sim, 8, 8);
    sim.people.village[i] = v;
    sim.villages.join(v);

    for (let t = 0; t < 1000; t++) {
      sim.tick();
      // Ses destinations sont à WANDER_RADIUS tuiles au plus du centre : il ne s'en éloigne pas plus
      expect(Math.abs(sim.people.x[i] - 8.5)).toBeLessThanOrEqual(WANDER_RADIUS);
      expect(Math.abs(sim.people.y[i] - 8.5)).toBeLessThanOrEqual(WANDER_RADIUS);
    }
  });

  it('abandonne un village quand son dernier habitant meurt', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    const v = sim.villages.found(5, 5);
    const i = addAdult(sim, 5, 5);
    sim.people.village[i] = v;
    sim.villages.join(v);

    // Le dieu inonde sa tuile
    const tile = world.index(5, 5);
    world.elevation[tile] = 0.3;
    world.refreshTerrain(tile);
    sim.tick();

    expect(sim.people.count).toBe(0);
    expect(sim.villages.count).toBe(0);
  });

  it('foudroie les mortels proches du point d’impact, et eux seuls', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    sim.people.add(5, 5); // sur la tuile frappée
    sim.people.add(6, 6); // en diagonale : √2 ≈ 1,41 tuile, sous le rayon de 1,5
    sim.people.add(7, 5); // à 2 tuiles : épargné
    sim.people.add(20, 20); // loin : épargné

    expect(LIGHTNING_RADIUS).toBe(1.5);
    expect(sim.strikeLightning(5, 5).victims).toBe(2);

    expect(sim.people.count).toBe(2);
    const survivors = [sim.people.x[0], sim.people.x[1]].sort((a, b) => a - b);
    expect(survivors).toEqual([7.5, 20.5]);
  });

  it('brûle la nourriture autour du point d’impact', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);

    sim.strikeLightning(5, 5);

    expect(sim.food[world.index(5, 5)]).toBe(0);
    expect(sim.food[world.index(6, 6)]).toBe(0);
    expect(sim.food[world.index(7, 5)]).toBe(2);
  });

  it('retire les foudroyés de leur village', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const v = sim.villages.found(5, 5);
    for (const x of [5, 9]) {
      const i = addAdult(sim, x, 5);
      sim.people.village[i] = v;
      sim.villages.join(v);
    }

    sim.strikeLightning(5, 5);

    expect(sim.villages.population[v]).toBe(1);
    expect(sim.villages.count).toBe(1);
  });

  it('dit quel village la foudre a le plus touché', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const a = sim.villages.found(2, 2);
    const b = sim.villages.found(25, 25);
    // 1 victime de a et 2 de b, toutes sur la tuile frappée
    for (const v of [a, b, b]) {
      const i = addAdult(sim, 5, 5);
      sim.people.village[i] = v;
      sim.villages.join(v);
    }

    const result = sim.strikeLightning(5, 5);

    expect(result.victims).toBe(3);
    expect(result.mostAffectedVillage).toBe(b);
  });

  it('allume un incendie si la foudre tombe sur la végétation, pas sur la plage', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    expect(sim.strikeLightning(5, 5).tilesIgnited).toBe(1);
    expect(sim.fire.count).toBe(1);

    const beach = new Simulation(sandWorld(), 1);
    expect(beach.strikeLightning(5, 5).tilesIgnited).toBe(0);
    expect(beach.fire.count).toBe(0);
  });

  it('le pouvoir Incendie embrase la tuile visée et ses 4 voisines, sauf l’eau', () => {
    expect(FIRE_RADIUS).toBe(1);
    const sim = new Simulation(grassWorldWithRiver(), 1);
    expect(sim.igniteFire(5, 5).tilesIgnited).toBe(5);

    // Au bord de la rivière (x = 16) : la voisine de droite est de l'eau
    const riverside = new Simulation(grassWorldWithRiver(), 1);
    expect(riverside.igniteFire(15, 5).tilesIgnited).toBe(4);
  });

  it('tue les mortels pris dans les flammes', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    addAdult(sim, 5, 5);
    addAdult(sim, 25, 25);

    sim.fire.ignite(world.index(5, 5));
    sim.tick();

    expect(sim.people.count).toBe(1);
    expect(sim.people.x[0]).toBe(25.5);
  });

  it('une forêt brûlée redevient prairie, sans nourriture, et la zone est à redessiner', () => {
    const world = sandWorld(5, 5);
    const tile = world.index(5, 5);
    world.moisture[tile] = 0.8;
    world.refreshTerrain(tile);
    expect(world.getTerrain(5, 5)).toBe(Terrain.Forest);
    const sim = new Simulation(world, 1);

    sim.fire.ignite(tile);
    runUntil(sim, () => sim.fire.count === 0);

    expect(world.getTerrain(5, 5)).toBe(Terrain.Grass);
    expect(sim.food[tile]).toBe(0);
    expect(sim.takeDirtyRect()).toEqual({ x0: 5, y0: 5, x1: 5, y1: 5 });
    // Déjà redessinée : plus rien à faire
    expect(sim.takeDirtyRect()).toBeNull();
  });
});