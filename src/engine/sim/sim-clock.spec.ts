import { describe, it, expect } from 'vitest';
import { MAX_TICKS_PER_ADVANCE, SimClock } from './sim-clock';

/** Fait avancer l'horloge de plusieurs images et renvoie le total de pas */
function run(clock: SimClock, frames: number, dt: number): number {
  let total = 0;
  for (let i = 0; i < frames; i++) {
    total += clock.advance(dt);
  }
  return total;
}

describe('SimClock', () => {
  it('démarre à x1, au pas 0', () => {
    const clock = new SimClock();
    expect(clock.speed).toBe(1);
    expect(clock.tick).toBe(0);
  });

  it('joue 10 pas par seconde à x1', () => {
    const clock = new SimClock();
    // 20 images de 0,05 s = 1 seconde
    expect(run(clock, 20, 0.05)).toBe(10);
    expect(clock.tick).toBe(10);
  });

  it('va deux fois plus vite à x2 et cinq fois plus vite à x5', () => {
    const x2 = new SimClock();
    x2.setSpeed(2);
    expect(run(x2, 20, 0.05)).toBe(20);

    const x5 = new SimClock();
    x5.setSpeed(5);
    expect(run(x5, 20, 0.05)).toBe(50);
  });

  it('garde les fractions de pas pour l’image suivante', () => {
    const clock = new SimClock();
    // 0,05 s à x1 = un demi-pas : rien la première fois, un pas la seconde
    expect(clock.advance(0.05)).toBe(0);
    expect(clock.advance(0.05)).toBe(1);
  });

  it('ne joue aucun pas en pause', () => {
    const clock = new SimClock();
    clock.setSpeed(0);
    expect(run(clock, 20, 0.05)).toBe(0);
    expect(clock.tick).toBe(0);
  });

  it('plafonne le nombre de pas joués d’un coup', () => {
    const clock = new SimClock();
    clock.setSpeed(5);
    // 1 s à x5 = 50 pas demandés
    expect(clock.advance(1)).toBe(MAX_TICKS_PER_ADVANCE);
    // Le surplus est abandonné, pas reporté
    expect(clock.advance(0)).toBe(0);
    expect(clock.advance(0.05)).toBe(2);
  });

  it('se remet à zéro sans changer de vitesse', () => {
    const clock = new SimClock();
    clock.setSpeed(2);
    run(clock, 10, 0.05);
    clock.reset();
    expect(clock.tick).toBe(0);
    expect(clock.speed).toBe(2);
  });
});