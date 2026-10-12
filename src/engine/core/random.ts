/**
 * Générateur pseudo-aléatoire reproductible (algorithme mulberry32).
 * Même graine => même suite de nombres => même monde.
 * Ne jamais utiliser Math.random() dans le moteur, sauf pour créer une graine.
 */
export class Random {
  private state: number;

  constructor(public readonly seed: number) {
    this.state = seed | 0;
  }

  /** Nombre décimal dans [0, 1[ */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max], bornes incluses */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Décimal dans [min, max[ */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Vrai avec une probabilité p (entre 0 et 1) */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Un élément au hasard dans un tableau */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Crée une graine aléatoire pour un nouveau monde */
  static newSeed(): number {
    return Math.floor(Math.random() * 0xffffffff);
  }
}