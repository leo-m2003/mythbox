import { SEASONS_PER_YEAR, TICKS_PER_SEASON, type Season } from '../sim/calendar';
import { TICKS_PER_YEAR } from '../sim/sim-clock';
import { Terrain, TERRAIN_INFO } from '../world/terrain';

/** Une couleur rouge, vert, bleu (de 0 à 255) */
export type Rgb = readonly [number, number, number];

/** La couleur d'un terrain dans TERRAIN_INFO : c'est celle du printemps */
const spring = (terrain: Terrain): Rgb => TERRAIN_INFO[terrain].color;

/**
 * Couleur des terrains qui changent avec les saisons, dans l'ordre : printemps, été, automne, hiver.
 * L'eau, la plage, la roche et les sommets ne changent pas.
 */
const SEASON_COLORS: Partial<Record<Terrain, readonly [Rgb, Rgb, Rgb, Rgb]>> = {
  // L'herbe jaunit l'été, et pâlit l'hiver
  [Terrain.Grass]: [spring(Terrain.Grass), [144, 156, 72], [134, 140, 74], [112, 128, 98]],
  // Les forêts foncent l'été, roussissent à l'automne, et se dénudent l'hiver
  [Terrain.Forest]: [spring(Terrain.Forest), [44, 98, 48], [152, 86, 42], [70, 86, 74]],
  // Les collines sèchent l'été, et grisent l'hiver
  [Terrain.Hills]: [spring(Terrain.Hills), [142, 126, 82], [136, 112, 78], [118, 116, 108]],
};

/** Part de la saison pendant laquelle ses couleurs ne bougent pas : ses deux premiers mois */
const STEADY_PART = 2 / 3;

/**
 * Couleur de chaque terrain au pas `tick`, rangée comme l'enum Terrain.
 * Une saison garde ses couleurs pendant ses deux premiers mois. Pendant le troisième,
 * elles glissent vers celles de la saison suivante, qui sont là dès son premier jour.
 */
export function seasonColors(tick: number): Rgb[] {
  const tickOfYear = tick % TICKS_PER_YEAR;
  const season = Math.floor(tickOfYear / TICKS_PER_SEASON) as Season;
  const next = ((season + 1) % SEASONS_PER_YEAR) as Season;
  // Avancée dans la saison, de 0 à 1
  const progress = (tickOfYear % TICKS_PER_SEASON) / TICKS_PER_SEASON;
  // Part de la saison suivante : 0 pendant les deux premiers mois, puis de 0 à 1 pendant le troisième
  const blend = Math.max(0, (progress - STEADY_PART) / (1 - STEADY_PART));

  // Object.values parcourt les terrains dans l'ordre 0 à 7, comme FOOD_CAPACITY dans la simulation
  return Object.values(TERRAIN_INFO).map((info, terrain) => {
    const colors = SEASON_COLORS[terrain as Terrain];
    return colors ? mix(colors[season], colors[next], blend) : info.color;
  });
}

/** Vrai si les deux couleurs sont identiques */
export function sameColor(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Mélange deux couleurs : t = 0 donne a, t = 1 donne b.
 * Arrondi à l'entier : la couleur ne change que quand la différence se voit.
 */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}