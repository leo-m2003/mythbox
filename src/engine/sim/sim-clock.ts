/** Nombre de pas de simulation par seconde, à la vitesse x1 */
export const TICKS_PER_SECOND = 10;

/** Nombre de pas de simulation dans une journée du jeu (une journée = 1 s à x1) */
export const TICKS_PER_DAY = 10;

/** Nombre de jours dans un mois du jeu (un mois = 10 s à x1) */
export const DAYS_PER_MONTH = 10;

/** Nombre de mois dans une année du jeu (une année = 2 minutes à x1) */
export const MONTHS_PER_YEAR = 12;

/** Nombre de pas de simulation dans un mois */
export const TICKS_PER_MONTH = TICKS_PER_DAY * DAYS_PER_MONTH;

/** Nombre de pas de simulation dans une année */
export const TICKS_PER_YEAR = TICKS_PER_MONTH * MONTHS_PER_YEAR;

/** Vitesses possibles : 0 = pause */
export const SIM_SPEEDS = [0, 1, 2, 5, 10] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

/**
 * Nombre maximal de pas joués d'un coup (une image de 0,05 s à x10 en demande juste 5).
 * Si l'ordinateur rame, la simulation ralentit au lieu de geler l'écran
 * en essayant de rattraper son retard.
 */
export const MAX_TICKS_PER_ADVANCE = 5;

/**
 * Horloge de la simulation, à pas fixe.
 * Le rendu suit le rythme de l'écran (dt variable), mais la simulation avance
  * toujours par pas identiques : son résultat ne dépend pas de la machine.
 * L'horloge dit seulement combien de pas jouer : c'est la simulation qui les compte (`Simulation.ticks`).
 */
export class SimClock {
  private currentSpeed: SimSpeed = 1;
  /** Fraction de pas en attente (entre 0 et 1) */
  private pending = 0;

  get speed(): SimSpeed {
    return this.currentSpeed;
  }

  setSpeed(speed: SimSpeed): void {
    this.currentSpeed = speed;
  }

  /** Oublie la fraction de pas en attente (nouveau monde), sans changer la vitesse */
  reset(): void {
    this.pending = 0;
  }

  /**
   * Ajoute le temps réel écoulé (en secondes) et renvoie
   * le nombre de pas de simulation à jouer maintenant.
   */
  advance(dt: number): number {
    if (dt <= 0 || this.currentSpeed === 0) return 0;

    this.pending += dt * this.currentSpeed * TICKS_PER_SECOND;
    let ticks = Math.floor(this.pending);
    this.pending -= ticks;

    if (ticks > MAX_TICKS_PER_ADVANCE) {
      // Trop de retard : on abandonne le surplus plutôt que de le rattraper
      ticks = MAX_TICKS_PER_ADVANCE;
      this.pending = 0;
    }

    return ticks;
  }
}