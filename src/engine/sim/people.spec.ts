import { describe, it, expect } from 'vitest';
import { MAX_PEOPLE, People } from './people';

describe('People', () => {
  it('place un nouvel habitant au centre de sa tuile', () => {
    const people = new People();
    const i = people.add(3, 5);
    expect(i).toBe(0);
    expect(people.count).toBe(1);
    expect(people.x[i]).toBe(3.5);
    expect(people.y[i]).toBe(5.5);
  });

  it('refuse un habitant de trop', () => {
    const people = new People();
    for (let n = 0; n < MAX_PEOPLE; n++) {
      people.add(0, 0);
    }
    expect(people.add(0, 0)).toBe(-1);
    expect(people.count).toBe(MAX_PEOPLE);
  });

  it('remplace un habitant retiré par le dernier', () => {
    const people = new People();
    people.add(1, 1);
    people.add(2, 2);
    people.add(3, 3);

    people.remove(0);

    expect(people.count).toBe(2);
    expect(people.x[0]).toBe(3.5);
    expect(people.x[1]).toBe(2.5);
  });
});