// @vitest-environment node
// Le moteur n'a pas besoin du DOM : sans jsdom, on mesure le moteur seul, comme dans le navigateur
import { describe, it, expect } from 'vitest';
import { Random } from '../core/random';
import { generateWorld } from '../world/generator';
import { ADULT_AGE, HUNGRY_AT, Simulation } from './simulation';
import { TICKS_PER_SECOND, TICKS_PER_YEAR } from './sim-clock';

/** Le monde du banc d'essai : la carte agrandie de la v0.6, avec 2 000 mortels */
const WIDTH = 512;
const HEIGHT = 384;
const PEOPLE = 2000;

/** Pas mesurés, après quelques pas d'échauffement */
const WARM_UP_TICKS = 50;
const MEASURED_TICKS = 1000;

/** Budget de la simulation, en millisecondes par image : la moitié d'une image à 60 par seconde */
const BUDGET_MS = 8;

/** À x10 et à 60 images par seconde, une image joue au plus 2 pas (100 pas par seconde) */
const TICKS_PER_FRAME = Math.ceil((10 * TICKS_PER_SECOND) / 60);

/** Le monde du banc d'essai, avec ses mortels éparpillés au hasard sur la terre ferme */
function crowdedWorld(): Simulation {
  const world = generateWorld({ width: WIDTH, height: HEIGHT, seed: 42 });
  const sim = new Simulation(world, 42);
  const random = new Random(42);
  while (sim.people.count < PEOPLE) {
    const x = random.int(0, WIDTH - 1);
    const y = random.int(0, HEIGHT - 1);
    if (!sim.isWalkable(x, y)) continue;
    const i = sim.people.add(x, y, 70 * TICKS_PER_YEAR);
    // Des adultes d'âges et de faims différents
    sim.people.age[i] = random.int(ADULT_AGE, 40 * TICKS_PER_YEAR);
    sim.people.hunger[i] = random.int(0, HUNGRY_AT);
  }
  return sim;
}

describe('Banc d’essai', () => {
  it('tient le budget de x10 avec 2 000 mortels sur 512 × 384 tuiles', { timeout: 60_000 }, () => {
    const sim = crowdedWorld();
    for (let t = 0; t < WARM_UP_TICKS; t++) sim.tick();

    const start = performance.now();
    for (let t = 0; t < MEASURED_TICKS; t++) sim.tick();
    const perTick = (performance.now() - start) / MEASURED_TICKS;
    const perFrame = perTick * TICKS_PER_FRAME;
    // Le résultat s'affiche dans la console de ng test : on le suit d'une version à l'autre
    const result = `${perTick.toFixed(2)} ms par pas, ${perFrame.toFixed(2)} ms par image à x10`;
    console.log(`Banc d'essai : ${result} (budget : ${BUDGET_MS} ms)`);

    // Les mortels sont bien là pendant toute la mesure
    expect(sim.people.count).toBeGreaterThan(PEOPLE * 0.9);
    expect(perFrame).toBeLessThan(BUDGET_MS);
  });
});