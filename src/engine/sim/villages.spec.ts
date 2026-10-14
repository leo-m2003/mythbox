import { describe, it, expect } from 'vitest';
import { MAX_VILLAGES, Villages } from './villages';

describe('Villages', () => {
  it('fonde un village vide', () => {
    const villages = new Villages();
    const v = villages.found(10, 12);
    expect(v).toBe(0);
    expect(villages.count).toBe(1);
    expect(villages.x[v]).toBe(10);
    expect(villages.y[v]).toBe(12);
    expect(villages.population[v]).toBe(0);
  });

  it('abandonne un village quand son dernier habitant part, et réutilise sa case', () => {
    const villages = new Villages();
    const a = villages.found(1, 1);
    const b = villages.found(20, 20);
    villages.join(a);
    villages.join(b);

    villages.leave(a);
    expect(villages.count).toBe(1);
    expect(villages.active[a]).toBe(0);
    // Le numéro de b ne change pas
    expect(villages.active[b]).toBe(1);

    expect(villages.found(5, 5)).toBe(a);
  });

  it('refuse un village de trop', () => {
    const villages = new Villages();
    for (let v = 0; v < MAX_VILLAGES; v++) {
      villages.found(0, 0);
    }
    expect(villages.found(0, 0)).toBe(-1);
  });

  it('trouve le village le plus proche dans un rayon donné', () => {
    const villages = new Villages();
    villages.found(0, 0);
    const near = villages.found(10, 0);
    villages.found(30, 0);

    expect(villages.nearest(13, 0, 6)).toBe(near);
    // 7 tuiles du plus proche : trop loin pour un rayon de 6
    expect(villages.nearest(17, 0, 6)).toBe(-1);
  });
});