import { TICKS_PER_DAY, TICKS_PER_MONTH, TICKS_PER_YEAR } from './sim-clock';

/** Les quatre saisons, dans l'ordre de l'année : l'an commence au printemps */
export enum Season {
  Spring,
  Summer,
  Autumn,
  Winter,
}

/** Nombre de saisons dans une année */
export const SEASONS_PER_YEAR = 4;

/** Nombre de pas de simulation dans une saison (3 mois) */
export const TICKS_PER_SEASON = TICKS_PER_YEAR / SEASONS_PER_YEAR;

/** Nom de chaque saison, pour l'interface */
export const SEASON_NAMES: Record<Season, string> = {
  [Season.Spring]: 'Printemps',
  [Season.Summer]: 'Été',
  [Season.Autumn]: 'Automne',
  [Season.Winter]: 'Hiver',
};

/** Une date du jeu */
export interface GameDate {
  /** Année, à partir de 1 */
  year: number;
  /** Mois dans l'année, de 1 à 12 */
  month: number;
  /** Jour dans le mois, de 1 à 10 */
  day: number;
  season: Season;
}

/** La date au pas `tick` : le pas 0 est le 1er jour du 1er mois de l'an 1, au printemps */
export function dateAt(tick: number): GameDate {
  return {
    year: Math.floor(tick / TICKS_PER_YEAR) + 1,
    month: Math.floor((tick % TICKS_PER_YEAR) / TICKS_PER_MONTH) + 1,
    day: Math.floor((tick % TICKS_PER_MONTH) / TICKS_PER_DAY) + 1,
    season: seasonAt(tick),
  };
}

/** La saison au pas `tick` : printemps les mois 1 à 3, été 4 à 6, automne 7 à 9, hiver 10 à 12 */
export function seasonAt(tick: number): Season {
  return Math.floor((tick % TICKS_PER_YEAR) / TICKS_PER_SEASON) as Season;
}