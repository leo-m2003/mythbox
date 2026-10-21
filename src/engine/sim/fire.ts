import { Random } from '../core/random';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { World } from '../world/world';
import { TICKS_PER_MONTH } from './sim-clock';

/**
 * Après un incendie, la terre reste brûlée pendant 6 mois (3 minutes à x1) :
 * rien n'y brûle ni n'y repousse, puis la prairie revient.
 */
export const SCORCH_TICKS = 6 * TICKS_PER_MONTH;

/** Une terre mouillée par la pluie ne peut pas brûler pendant 1 mois (30 secondes à x1) */
export const WET_TICKS = TICKS_PER_MONTH;

/** Inflammabilité et durée de combustion par terrain, en tableaux typés (lus pour chaque tuile en feu) */
const FLAMMABILITY = Float32Array.from(
  Object.values(TERRAIN_INFO).map((info) => info.flammability),
);
const BURN_TICKS = Uint8Array.from(Object.values(TERRAIN_INFO).map((info) => info.burnTicks));

/**
 * Les incendies : trois couches de plus sur la grille du monde.
 * - burning : pas de combustion restants (0 = pas de feu) ;
 * - scorched : pas restants avant que la terre brûlée puisse brûler à nouveau ;
 * - wet : pas restants avant que la terre mouillée par la pluie sèche.
 */
export class Fire {
  readonly burning: Uint8Array;
  readonly scorched: Uint16Array;
  readonly wet: Uint16Array;
  /** Nombre de tuiles en feu */
  count = 0;
  /** Nombre de tuiles encore marquées par un incendie */
  scorchedCount = 0;
  /** Nombre de tuiles encore mouillées */
  wetCount = 0;
  /**
   * Altitude à partir de laquelle la neige couvre le sol : rien n'y brûle.
   * La simulation la met à jour à chaque pas (Infinity = pas de neige).
   */
  snowElevation = Infinity;

  /** Tuiles qui prendront feu à la fin du pas (réutilisé d'un pas à l'autre) */
  private readonly spreading: number[] = [];

  constructor(private readonly world: World) {
    this.burning = new Uint8Array(world.size);
    this.scorched = new Uint16Array(world.size);
    this.wet = new Uint16Array(world.size);
  }

  /** Vrai si la tuile i peut prendre feu maintenant */
  canBurn(i: number): boolean {
    return (
      this.burning[i] === 0 &&
      this.scorched[i] === 0 &&
      this.wet[i] === 0 &&
      this.world.elevation[i] < this.snowElevation &&
      FLAMMABILITY[this.world.terrain[i]] > 0
    );
  }

  /** Met le feu à la tuile i, si elle peut brûler. Renvoie vrai si elle s'est enflammée */
  ignite(i: number): boolean {
    if (!this.canBurn(i)) return false;
    this.burning[i] = BURN_TICKS[this.world.terrain[i]];
    this.count++;
    return true;
  }

  /** Éteint la tuile i sans la marquer comme brûlée (pluie, inondation) */
  extinguish(i: number): void {
    if (this.burning[i] === 0) return;
    this.burning[i] = 0;
    this.count--;
  }

  /** Mouille la tuile i : elle ne pourra pas brûler pendant WET_TICKS pas */
  soak(i: number): void {
    if (this.wet[i] === 0) this.wetCount++;
    this.wet[i] = WET_TICKS;
  }

  /** Rapproche de `ticks` pas la fin de la terre brûlée sur la tuile i (la pluie fait repousser l'herbe) */
  regrow(i: number, ticks: number): void {
    if (this.scorched[i] === 0) return;
    this.scorched[i] = Math.max(0, this.scorched[i] - ticks);
    if (this.scorched[i] === 0) this.scorchedCount--;
  }

  /**
   * Un pas de simulation : le feu se propage aux voisines, puis chaque tuile en feu se consume.
   * `onBurnedOut(i)` est appelé quand la tuile i finit de brûler.
   */
  tick(random: Random, onBurnedOut: (i: number) => void): void {
    // Rien à faire : on évite de parcourir les 49 152 tuiles
    if (this.count === 0 && this.scorchedCount === 0 && this.wetCount === 0) return;

    const { burning, scorched, wet, world } = this;
    const width = world.width;

    for (let i = 0; i < burning.length; i++) {
      if (scorched[i] > 0) {
        const terrain = world.terrain[i];
        if (FLAMMABILITY[terrain] === 0 || terrain === Terrain.Forest) {
          // Le dieu a noyé ou replanté la terre brûlée : elle n'est plus brûlée
          scorched[i] = 0;
        } else {
          scorched[i]--;
        }
        if (scorched[i] === 0) this.scorchedCount--;
      }
      if (wet[i] > 0) {
        wet[i]--;
        if (wet[i] === 0) this.wetCount--;
      }
      if (burning[i] === 0) continue;

      // Un pinceau a pu noyer la tuile en feu, ou la neige la couvrir : elles éteignent le feu
      if (FLAMMABILITY[world.terrain[i]] === 0 || world.elevation[i] >= this.snowElevation) {
        this.extinguish(i);
        continue;
      }

      // Propagation aux 4 voisines (haut, bas, gauche, droite)
      const x = i % width;
      if (x > 0) this.trySpread(i - 1, random);
      if (x < width - 1) this.trySpread(i + 1, random);
      if (i >= width) this.trySpread(i - width, random);
      if (i + width < burning.length) this.trySpread(i + width, random);

      burning[i]--;
      if (burning[i] === 0) {
        this.count--;
        scorched[i] = SCORCH_TICKS;
        this.scorchedCount++;
        onBurnedOut(i);
      }
    }

    // Les nouvelles tuiles ne s'allument qu'à la fin du pas : sinon, le feu traverserait
    // la carte d'un coup vers la droite et le bas, dans le sens de la boucle.
    for (const n of this.spreading) {
      this.ignite(n);
    }
    this.spreading.length = 0;
  }

  private trySpread(n: number, random: Random): void {
    if (this.canBurn(n) && random.chance(FLAMMABILITY[this.world.terrain[n]])) {
      this.spreading.push(n);
    }
  }
}
