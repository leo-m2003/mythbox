import { Random } from '../core/random';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { World } from '../world/world';
import { TICKS_PER_YEAR } from './sim-clock';

/**
 * Après un incendie, la terre reste brûlée pendant 2 ans : rien n'y brûle ni n'y repousse,
 * puis la prairie revient.
 */
export const SCORCH_TICKS = 2 * TICKS_PER_YEAR;

/** Inflammabilité et durée de combustion par terrain, en tableaux typés (lus pour chaque tuile en feu) */
const FLAMMABILITY = Float32Array.from(Object.values(TERRAIN_INFO).map((info) => info.flammability));
const BURN_TICKS = Uint8Array.from(Object.values(TERRAIN_INFO).map((info) => info.burnTicks));

/**
 * Les incendies : deux couches de plus sur la grille du monde.
 * - burning : pas de combustion restants (0 = pas de feu) ;
 * - scorched : pas restants avant que la terre brûlée puisse brûler à nouveau.
 */
export class Fire {
  readonly burning: Uint8Array;
  readonly scorched: Uint16Array;
  /** Nombre de tuiles en feu */
  count = 0;
  /** Nombre de tuiles encore marquées par un incendie */
  scorchedCount = 0;

  /** Tuiles qui prendront feu à la fin du pas (réutilisé d'un pas à l'autre) */
  private readonly spreading: number[] = [];

  constructor(private readonly world: World) {
    this.burning = new Uint8Array(world.size);
    this.scorched = new Uint16Array(world.size);
  }

  /** Vrai si la tuile i peut prendre feu maintenant */
  canBurn(i: number): boolean {
    return (
      this.burning[i] === 0 && this.scorched[i] === 0 && FLAMMABILITY[this.world.terrain[i]] > 0
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

  /**
   * Un pas de simulation : le feu se propage aux voisines, puis chaque tuile en feu se consume.
   * `onBurnedOut(i)` est appelé quand la tuile i finit de brûler.
   */
  tick(random: Random, onBurnedOut: (i: number) => void): void {
    // Rien à faire : on évite de parcourir les 49 152 tuiles
    if (this.count === 0 && this.scorchedCount === 0) return;

    const { burning, scorched, world } = this;
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
      if (burning[i] === 0) continue;

      // Un pinceau a pu noyer la tuile en feu : l'eau éteint le feu
      if (FLAMMABILITY[world.terrain[i]] === 0) {
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