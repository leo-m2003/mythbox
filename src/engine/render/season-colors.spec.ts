import { describe, it, expect } from 'vitest';
import { TICKS_PER_SEASON } from '../sim/calendar';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '../sim/sim-clock';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { sameColor, seasonColors } from './season-colors';

const SUMMER = TICKS_PER_SEASON;
const AUTUMN = 2 * TICKS_PER_SEASON;

/** Les terrains qui ne changent jamais de couleur */
const UNCHANGING = [
  Terrain.DeepWater,
  Terrain.ShallowWater,
  Terrain.Sand,
  Terrain.Mountain,
  Terrain.Snow,
];

describe('Couleurs des saisons', () => {
  it('donne au printemps les couleurs de TERRAIN_INFO', () => {
    const colors = seasonColors(0);
    for (const terrain of [Terrain.Grass, Terrain.Forest, Terrain.Hills, ...UNCHANGING]) {
      expect(colors[terrain]).toEqual(TERRAIN_INFO[terrain].color);
    }
  });

  it('jaunit l’herbe l’été et roussit les forêts à l’automne', () => {
    const spring = seasonColors(0);
    const summer = seasonColors(SUMMER);
    const autumn = seasonColors(AUTUMN);
    // Plus jaune : plus de rouge, à peu près autant de vert
    expect(summer[Terrain.Grass][0]).toBeGreaterThan(spring[Terrain.Grass][0] + 30);
    // Roux : le rouge passe devant le vert
    const [red, green] = autumn[Terrain.Forest];
    expect(red).toBeGreaterThan(green);
  });

  it('ne change ni l’eau, ni la plage, ni la roche, ni les sommets', () => {
    const spring = seasonColors(0);
    for (let tick = 0; tick < TICKS_PER_YEAR; tick += TICKS_PER_MONTH / 2) {
      const colors = seasonColors(tick);
      for (const terrain of UNCHANGING) {
        expect(colors[terrain]).toEqual(spring[terrain]);
      }
    }
  });

  it('garde les couleurs d’une saison pendant ses deux premiers mois', () => {
    const start = seasonColors(SUMMER);
    const endOfSecondMonth = seasonColors(SUMMER + 2 * TICKS_PER_MONTH - 1);
    expect(endOfSecondMonth[Terrain.Grass]).toEqual(start[Terrain.Grass]);
    expect(endOfSecondMonth[Terrain.Forest]).toEqual(start[Terrain.Forest]);
  });

  it('glisse vers la saison suivante pendant le troisième mois, sans saut', () => {
    // Au milieu du troisième mois de l'été : entre l'été et l'automne
    const summer = seasonColors(SUMMER)[Terrain.Forest];
    const autumn = seasonColors(AUTUMN)[Terrain.Forest];
    const between = seasonColors(SUMMER + 2.5 * TICKS_PER_MONTH)[Terrain.Forest];
    expect(between[0]).toBeGreaterThan(summer[0]);
    expect(between[0]).toBeLessThan(autumn[0]);

    // D'un pas à l'autre, la couleur bouge à peine, même au changement de saison et d'année
    for (let tick = 0; tick < 2 * TICKS_PER_YEAR; tick++) {
      const a = seasonColors(tick)[Terrain.Forest];
      const b = seasonColors(tick + 1)[Terrain.Forest];
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(a[c] - b[c])).toBeLessThanOrEqual(2);
      }
    }
  });

  it('grille la végétation pendant la sécheresse, d’autant plus que la terre est sèche', () => {
    const summer = seasonColors(SUMMER);
    const drying = seasonColors(SUMMER, 0.5);
    const dry = seasonColors(SUMMER, 1);
    // L'herbe grillée : plus de rouge, de plus en plus
    expect(drying[Terrain.Grass][0]).toBeGreaterThan(summer[Terrain.Grass][0] + 5);
    expect(dry[Terrain.Grass][0]).toBeGreaterThan(drying[Terrain.Grass][0] + 5);
    // Ni l'eau, ni la plage, ni la roche, ni les sommets
    for (const terrain of UNCHANGING) {
      expect(dry[terrain]).toEqual(summer[terrain]);
    }
  });

  it('compare deux couleurs', () => {
    expect(sameColor([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(sameColor([1, 2, 3], [1, 2, 4])).toBe(false);
  });
});
