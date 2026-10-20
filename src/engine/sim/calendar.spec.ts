import { describe, it, expect } from 'vitest';
import { dateAt, Season, seasonAt, TICKS_PER_SEASON } from './calendar';
import { TICKS_PER_DAY, TICKS_PER_MONTH, TICKS_PER_YEAR } from './sim-clock';

describe('Calendrier', () => {
  it('commence le 1er jour du 1er mois de l’an 1, au printemps', () => {
    expect(dateAt(0)).toEqual({ year: 1, month: 1, day: 1, season: Season.Spring });
  });

  it('change de jour tous les 30 pas, de mois tous les 10 jours, d’année tous les 12 mois', () => {
    expect(dateAt(TICKS_PER_DAY - 1).day).toBe(1);
    expect(dateAt(TICKS_PER_DAY).day).toBe(2);
    expect(dateAt(TICKS_PER_MONTH - 1)).toEqual({
      year: 1,
      month: 1,
      day: 10,
      season: Season.Spring,
    });
    expect(dateAt(TICKS_PER_MONTH).month).toBe(2);
    expect(dateAt(TICKS_PER_YEAR - 1)).toEqual({
      year: 1,
      month: 12,
      day: 10,
      season: Season.Winter,
    });
    expect(dateAt(TICKS_PER_YEAR)).toEqual({ year: 2, month: 1, day: 1, season: Season.Spring });
  });

  it('donne trois mois à chaque saison', () => {
    expect(TICKS_PER_SEASON).toBe(3 * TICKS_PER_MONTH);
    const seasonOfMonth = (month: number) => seasonAt((month - 1) * TICKS_PER_MONTH);
    expect([1, 2, 3].map(seasonOfMonth)).toEqual([Season.Spring, Season.Spring, Season.Spring]);
    expect([4, 5, 6].map(seasonOfMonth)).toEqual([Season.Summer, Season.Summer, Season.Summer]);
    expect([7, 8, 9].map(seasonOfMonth)).toEqual([Season.Autumn, Season.Autumn, Season.Autumn]);
    expect([10, 11, 12].map(seasonOfMonth)).toEqual([Season.Winter, Season.Winter, Season.Winter]);
  });

  it('retrouve les mêmes saisons chaque année', () => {
    for (let tick = 0; tick < TICKS_PER_YEAR; tick += TICKS_PER_DAY) {
      expect(seasonAt(tick + 7 * TICKS_PER_YEAR)).toBe(seasonAt(tick));
    }
  });
});
