import { describe, it, expect } from 'vitest';
import { Random } from './random';

describe('Random', () => {
  it('produit la même suite pour la même graine', () => {
    const a = new Random(42);
    const b = new Random(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produit des suites différentes pour des graines différentes', () => {
    const a = new Random(1);
    const b = new Random(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('reste dans [0, 1[', () => {
    const r = new Random(123);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int respecte ses bornes', () => {
    const r = new Random(7);
    for (let i = 0; i < 1_000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});