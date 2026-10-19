import { describe, it, expect } from 'vitest';
import { Terrain } from '../world/terrain';
import { World } from '../world/world';
import { TICKS_PER_SEASON } from './calendar';
import { SCORCH_TICKS } from './fire';
import { TICKS_PER_YEAR } from './sim-clock';
import {
  ADULT_AGE,
  BIRTH_COOLDOWN,
  BIRTH_HUNGER,
  BLESSED_BIRTH_CHANCE,
  FERTILE_UNTIL,
  FERTILITY_RADIUS,
  FIRE_RADIUS,
  FOOD_REGROWTH,
  HUNGRY_AT,
  INITIAL_PEOPLE,
  LIGHTNING_RADIUS,
  MAX_VILLAGE_SIZE,
  MIN_FOUNDERS,
  PORTION_VALUE,
  QUAKE_RADIUS,
  RAIN_FOOD,
  RAIN_RADIUS,
  Simulation,
  SKY_RAIN_FOOD,
  STARVATION,
  WANDER_RADIUS,
} from './simulation';
import type { Cloud, Strike } from './weather';

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

/** Un petit monde plat de prairie, sans rivière */
function grassWorld(): World {
  const world = new World(32, 32, 0, 0.38);
  world.elevation.fill(0.5);
  world.moisture.fill(0.3);
  world.refreshAllTerrain();
  return world;
}

/** Un nuage formé (il peut pleuvoir et gronder) au-dessus de (x, y) */
function formedCloud(x: number, y: number, rain: boolean, storm: boolean): Cloud {
  return { x, y, radius: 5, stretch: 1, mirrored: false, rain, storm, age: 500, life: 1000 };
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

/** Un îlot de prairie de 4 × 4 tuiles, de (4, 4) à (7, 7), au milieu de l'eau */
function smallIsland(): World {
  const world = new World(12, 12, 0, 0.38);
  world.elevation.fill(0.2);
  world.moisture.fill(0.3);
  for (let y = 4; y < 8; y++) {
    for (let x = 4; x < 8; x++) {
      world.elevation[world.index(x, y)] = 0.5;
    }
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

    // 5 ans tout rond : les saisons rapides et lentes se compensent
    for (let t = 0; t < 1 / FOOD_REGROWTH; t++) {
      sim.tick();
    }
    expect(sim.food[tile]).toBeCloseTo(1, 3);

    for (let t = 0; t < 2 / FOOD_REGROWTH; t++) {
      sim.tick();
    }
    expect(sim.food[tile]).toBe(2);
  });

  it('fait repousser la nourriture plus vite au printemps, et presque pas l’hiver', () => {
    const world = sandWorld(10, 5);
    const sim = new Simulation(world, 1);
    const tile = world.index(10, 5);
    sim.food[tile] = 0;

    // Ce qui repousse pendant chaque saison de la première année : printemps, été, automne, hiver
    const gains: number[] = [];
    for (let season = 0; season < 4; season++) {
      const before = sim.food[tile];
      for (let t = 0; t < TICKS_PER_SEASON; t++) sim.tick();
      gains.push(sim.food[tile] - before);
    }

    const [spring, summer, autumn, winter] = gains;
    expect(spring).toBeGreaterThan(summer);
    expect(summer).toBeGreaterThan(autumn);
    expect(autumn).toBeGreaterThan(winter);
    expect(winter).toBeLessThan(spring / 5);
    // Sur l'année, autant qu'avant les saisons
    expect(spring + summer + autumn + winter).toBeCloseTo(TICKS_PER_YEAR * FOOD_REGROWTH, 5);
  });

  it('compte les pas depuis le début du monde', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    expect(sim.ticks).toBe(0);
    for (let t = 0; t < 25; t++) sim.tick();
    expect(sim.ticks).toBe(25);
  });

  it('fait avancer la météo à chaque pas', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    // Un monde de 32 × 32 tuiles est trop petit pour avoir ses propres nuages : on en ajoute un
    const cloud = { ...formedCloud(10, 10, false, false), age: 0 };
    sim.weather.clouds.push(cloud);
    sim.tick();
    expect(cloud.x).toBeCloseTo(10 + sim.weather.windX, 5);
    expect(cloud.age).toBe(1);
  });

  it('arrose la terre sous les nuages de pluie, pas sous les autres', () => {
    const world = grassWorld();
    const sim = new Simulation(world, 1);
    // Un monde de 32 × 32 tuiles est trop petit pour avoir ses propres nuages : on en ajoute
    sim.weather.clouds.push(
      formedCloud(8.5, 8.5, true, false),
      formedCloud(24.5, 24.5, false, false),
    );
    const under = world.index(8, 8);
    sim.food[under] = 0;
    const burning = world.index(9, 8);
    sim.fire.ignite(burning);
    sim.tick();
    // Comme la pluie du dieu : le feu s'éteint, la terre est mouillée et nourrie
    expect(sim.fire.burning[burning]).toBe(0);
    expect(sim.fire.wet[under]).toBeGreaterThan(0);
    expect(sim.food[under]).toBeGreaterThanOrEqual(SKY_RAIN_FOOD);
    // Sous le nuage de beau temps, rien
    expect(sim.fire.wet[world.index(24, 24)]).toBe(0);
  });

  it('fait tomber la foudre des orages sur le monde', () => {
    const world = grassWorld();
    const sim = new Simulation(world, 1);
    sim.weather.clouds.push(formedCloud(16.5, 16.5, false, true));
    let strikes: Strike[] = [];
    runUntil(sim, () => (strikes = sim.takeStrikes()).length > 0, 300);
    expect(strikes.length).toBeGreaterThan(0);
    // Comme la foudre de Zeus : la nourriture brûle, et la prairie prend feu si le tirage le dit
    const { x, y, ignites } = strikes[0];
    expect(sim.food[world.index(x, y)]).toBeLessThan(0.01);
    expect(sim.fire.burning[world.index(x, y)] > 0).toBe(ignites);
    // Une fois pris, les coups de foudre sont oubliés
    expect(sim.takeStrikes()).toEqual([]);
  });

  it('n’allume pas de feu sous un orage qui pleut', () => {
    const world = grassWorld();
    const sim = new Simulation(world, 1);
    sim.weather.clouds.push(formedCloud(16.5, 16.5, true, true));
    let strikes: Strike[] = [];
    runUntil(sim, () => (strikes = sim.takeStrikes()).length > 0, 300);
    expect(strikes.length).toBeGreaterThan(0);
    // La pluie a mouillé la terre avant que la foudre tombe
    expect(sim.fire.count).toBe(0);
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
    // Un îlot de 4 × 4 tuiles : les deux adultes ne peuvent pas s'éloigner l'un de l'autre
    const sim = new Simulation(smallIsland(), 1);
    addAdult(sim, 5, 5);
    addAdult(sim, 6, 5);

    // Chacun a 1 chance sur 1 200 par pas, et l'autre doit être tout près à ce moment-là :
    // on laisse jusqu'à 20 000 pas (moins de 17 ans, ils restent en âge d'avoir des enfants)
    let t = 0;
    while (sim.people.count === 2 && t < 20_000) {
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
    // Comme pour le premier enfant : jusqu'à 20 000 pas, ils restent en âge d'avoir des enfants
    runUntil(sim, () => sim.people.count === 3, 20_000);

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

  it('peut frapper sans allumer de feu', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    addAdult(sim, 5, 5);
    const result = sim.strikeLightning(5, 5, false);
    // Le mortel meurt et la nourriture brûle, mais la prairie ne prend pas feu
    expect(result.victims).toBe(1);
    expect(sim.food[world.index(5, 5)]).toBe(0);
    expect(result.tilesIgnited).toBe(0);
    expect(sim.fire.count).toBe(0);
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

  it('rien ne repousse sur la terre brûlée pendant SCORCH_TICKS pas', () => {
    const world = sandWorld(5, 5);
    const tile = world.index(5, 5);
    const sim = new Simulation(world, 1);

    sim.fire.ignite(tile);
    runUntil(sim, () => sim.fire.count === 0);
    expect(sim.food[tile]).toBe(0);

    for (let t = 0; t < SCORCH_TICKS; t++) sim.tick();
    expect(sim.food[tile]).toBe(0);

    // La terre a récupéré : la prairie repousse
    sim.tick();
    expect(sim.food[tile]).toBeGreaterThan(0);
  });

  it('la pluie éteint le feu sans laisser de terre brûlée, et mouille la terre', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    sim.igniteFire(5, 5);
    expect(sim.fire.count).toBe(5);

    const result = sim.rain(5, 5, 0.1);

    expect(result.tilesExtinguished).toBe(5);
    expect(sim.fire.count).toBe(0);
    expect(sim.fire.scorchedCount).toBe(0);
    // La terre mouillée ne reprend pas feu tout de suite
    expect(sim.igniteFire(5, 5).tilesIgnited).toBe(0);
  });

  it('la pluie nourrit la terre, sans dépasser ce qu’elle peut porter', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    expect(RAIN_RADIUS).toBe(4);
    const center = world.index(5, 5);
    const outside = world.index(10, 5); // à 5 tuiles : hors de la pluie
    sim.food[center] = 0;
    sim.food[outside] = 0;

    // Toutes les autres tuiles sont pleines : seule la tuile vidée reçoit de la nourriture
    expect(RAIN_FOOD).toBe(0.5);
    expect(sim.rain(5, 5, 1).foodGiven).toBe(0.5);
    expect(sim.food[center]).toBe(0.5);
    expect(sim.food[outside]).toBe(0);

    sim.rain(5, 5, 10);
    // Une prairie porte 2 portions au plus
    expect(sim.food[center]).toBe(2);
  });

  it('la pluie fait repousser l’herbe sur la terre brûlée en 10 secondes', () => {
    const world = sandWorld(5, 5);
    const tile = world.index(5, 5);
    const sim = new Simulation(world, 1);
    sim.fire.ignite(tile);
    runUntil(sim, () => sim.fire.count === 0);
    expect(sim.fire.scorched[tile]).toBe(SCORCH_TICKS);

    // 9,9 secondes de pluie, en images de 0,1 s : pas encore tout à fait
    for (let t = 0; t < 99; t++) sim.rain(5, 5, 0.1);
    expect(sim.fire.scorched[tile]).toBeGreaterThan(0);
    expect(sim.food[tile]).toBe(0);

    sim.rain(5, 5, 0.1);
    expect(sim.fire.scorched[tile]).toBe(0);
    expect(sim.fire.scorchedCount).toBe(0);
  });

  it('la pluie ne tue personne et dit quel village elle arrose le plus', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const a = sim.villages.found(2, 2);
    const b = sim.villages.found(25, 25);
    for (const v of [a, b, b]) {
      const i = addAdult(sim, 5, 5);
      sim.people.village[i] = v;
      sim.villages.join(v);
    }

    const result = sim.rain(5, 5, 0.1);

    expect(result.victims).toBe(0);
    expect(result.mostAffectedVillage).toBe(b);
    expect(sim.people.count).toBe(3);
  });

  it('le séisme ouvre une faille à l’épicentre et ne touche pas au relief hors de sa zone', () => {
    const world = grassWorldWithRiver();
    const before = world.elevation.slice();
    const terrainBefore = world.terrain.slice();
    const sim = new Simulation(world, 1);
    expect(QUAKE_RADIUS).toBe(6);

    const result = sim.quake(8, 8);

    // La faille passe toujours par l'épicentre : la prairie s'y enfonce sous le niveau de la mer
    expect(world.elevation[world.index(8, 8)]).toBeLessThan(world.seaLevel);
    expect(sim.isWalkable(8, 8)).toBe(false);
    let changed = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const i = world.index(x, y);
        if (Math.hypot(x - 8, y - 8) > QUAKE_RADIUS + 1) {
          expect(world.elevation[i]).toBe(before[i]);
        }
        if (world.terrain[i] !== terrainBefore[i]) changed++;
      }
    }
    expect(result.terrainChanged).toBe(changed);
    // La zone à redessiner : le séisme et une tuile de plus tout autour
    expect(sim.takeDirtyRect()).toEqual({ x0: 1, y0: 1, x1: 15, y1: 15 });
  });

  it('le séisme tue ceux qui tombent dans la faille, et épargne ceux qui sont loin', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    for (let n = 0; n < 10; n++) {
      addAdult(sim, 8, 8); // à l'épicentre : dans la faille
      addAdult(sim, 25, 25); // loin
    }

    const result = sim.quake(8, 8);

    expect(result.victims).toBe(10);
    expect(sim.people.count).toBe(10);
    for (let i = 0; i < sim.people.count; i++) {
      expect(sim.people.x[i]).toBe(25.5);
    }
  });

  it('le séisme tue plus près de l’épicentre qu’au bord', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    // Une moitié à 2 tuiles de l'épicentre, l'autre à 5 tuiles
    for (let n = 0; n < 100; n++) {
      addAdult(sim, 8, 10);
      addAdult(sim, 8, 13);
    }

    sim.quake(8, 8);

    let nearSurvivors = 0;
    let farSurvivors = 0;
    for (let i = 0; i < sim.people.count; i++) {
      if (sim.people.y[i] === 10.5) nearSurvivors++;
      else farSurvivors++;
    }
    expect(nearSurvivors).toBeLessThan(farSurvivors);
    // Au bord, on meurt rarement
    expect(farSurvivors).toBeGreaterThan(50);
  });

  it('le même séisme, sur le même monde avec la même graine, fait les mêmes dégâts', () => {
    const a = grassWorldWithRiver();
    const b = grassWorldWithRiver();
    new Simulation(a, 7).quake(8, 8);
    new Simulation(b, 7).quake(8, 8);
    expect(a.elevation).toEqual(b.elevation);
  });

  it('la fertilité remplit la nourriture dans son rayon, et pas au-delà', () => {
    const world = grassWorldWithRiver();
    const sim = new Simulation(world, 1);
    expect(FERTILITY_RADIUS).toBe(5);
    const center = world.index(8, 8);
    const edge = world.index(13, 8); // à 5 tuiles : encore dans la zone
    const outside = world.index(14, 8); // à 6 tuiles : hors de la zone
    sim.food[center] = 0;
    sim.food[edge] = 0.5;
    sim.food[outside] = 0;

    const result = sim.bless(8, 8);

    // Une prairie porte 2 portions au plus ; toutes les autres tuiles étaient déjà pleines
    expect(sim.food[center]).toBe(2);
    expect(sim.food[edge]).toBe(2);
    expect(sim.food[outside]).toBe(0);
    expect(result.foodGiven).toBe(3.5);
    expect(result.victims).toBe(0);
  });

  it('la fertilité fait reverdir la terre brûlée sur-le-champ', () => {
    const world = sandWorld(5, 5);
    const tile = world.index(5, 5);
    const sim = new Simulation(world, 1);
    sim.fire.ignite(tile);
    runUntil(sim, () => sim.fire.count === 0);
    expect(sim.fire.scorched[tile]).toBe(SCORCH_TICKS);

    sim.bless(5, 5);

    expect(sim.fire.scorched[tile]).toBe(0);
    expect(sim.fire.scorchedCount).toBe(0);
    expect(sim.food[tile]).toBe(2);
  });

  it('la fertilité rassasie les mortels, ne tue personne et dit quel village elle bénit le plus', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const a = sim.villages.found(2, 2);
    const b = sim.villages.found(25, 25);
    for (const v of [a, b, b]) {
      const i = addAdult(sim, 8, 8);
      sim.people.village[i] = v;
      sim.villages.join(v);
    }
    const far = addAdult(sim, 25, 25);
    for (let i = 0; i < sim.people.count; i++) {
      sim.people.hunger[i] = HUNGRY_AT;
      // Ils viennent d'avoir un enfant : pas de nouvelle naissance, seule la faim compte ici
      sim.people.birthCooldown[i] = BIRTH_COOLDOWN;
    }

    const result = sim.bless(8, 8);

    expect(result.victims).toBe(0);
    expect(result.childrenBorn).toBe(0);
    expect(result.mostAffectedVillage).toBe(b);
    expect(sim.people.count).toBe(4);
    for (let i = 0; i < 3; i++) {
      expect(sim.people.hunger[i]).toBe(0);
    }
    expect(sim.people.hunger[far]).toBe(HUNGRY_AT);
  });

  it('la fertilité fait naître des enfants aux seuls adultes en âge, et un seul par délai', () => {
    const sim = new Simulation(grassWorldWithRiver(), 1);
    const PARENTS = 100;
    for (let n = 0; n < PARENTS; n++) addAdult(sim, 8, 8);
    // Ceux-là n'auront pas d'enfant : trop jeunes, trop âgés, ou trop loin
    for (let n = 0; n < 10; n++) {
      sim.people.add(8, 8);
      const elder = addAdult(sim, 8, 8);
      sim.people.age[elder] = FERTILE_UNTIL;
      addAdult(sim, 25, 25);
    }
    const before = sim.people.count;

    const first = sim.bless(8, 8);

    // Une chance sur deux chacun : autour de 50 enfants sur 100 adultes
    expect(BLESSED_BIRTH_CHANCE).toBe(0.5);
    expect(first.childrenBorn).toBeGreaterThan(30);
    expect(first.childrenBorn).toBeLessThan(70);
    expect(sim.people.count).toBe(before + first.childrenBorn);
    // Les nouveau-nés sont à la fin, sur la tuile de leur parent
    for (let i = before; i < sim.people.count; i++) {
      expect(sim.people.age[i]).toBe(0);
      expect(sim.people.x[i]).toBe(8.5);
    }
    // Les parents attendent avant le prochain enfant, et restent rassasiés
    for (let i = 0; i < PARENTS; i++) {
      if (sim.people.birthCooldown[i] > 0) expect(sim.people.hunger[i]).toBe(0);
    }
    for (let i = PARENTS; i < before; i++) {
      expect(sim.people.birthCooldown[i]).toBe(0);
    }

    // Une deuxième bénédiction : seuls ceux qui n'ont pas encore eu d'enfant peuvent en avoir un
    const second = sim.bless(8, 8);
    let parents = 0;
    for (let i = 0; i < PARENTS; i++) {
      if (sim.people.birthCooldown[i] > 0) parents++;
    }
    expect(second.childrenBorn).toBeGreaterThan(0);
    expect(parents).toBe(first.childrenBorn + second.childrenBorn);
  });
});
