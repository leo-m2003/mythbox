import { describe, expect, it } from 'vitest';
import { MAX_SEED, seedFromText } from './seed';

describe('seedFromText', () => {
  it('garde un nombre tel quel', () => {
    expect(seedFromText('12345')).toBe(12345);
  });

  it('ignore les espaces autour', () => {
    expect(seedFromText('  42 ')).toBe(42);
  });

  it('donne toujours la même graine pour le même mot', () => {
    expect(seedFromText('olympe')).toBe(seedFromText('olympe'));
  });

  it('donne des graines différentes pour des mots différents', () => {
    expect(seedFromText('olympe')).not.toBe(seedFromText('asgard'));
  });

  it('produit toujours une graine valide', () => {
    for (const text of ['olympe', 'Zeus', '99999999999', 'é']) {
      const seed = seedFromText(text)!;
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });

  it('renvoie null pour un texte vide', () => {
    expect(seedFromText('   ')).toBeNull();
  });
});