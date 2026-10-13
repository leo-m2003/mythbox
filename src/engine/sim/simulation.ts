import { Random } from '../core/random';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { World } from '../world/world';
import { People } from './people';

/** Nombre d'habitants au début d'un monde */
export const INITIAL_PEOPLE = 20;

/** Distance maximale d'une promenade, en tuiles */
const WANDER_RADIUS = 6;

/** Vitesse de marche, en tuiles par pas (1,5 tuile par seconde à x1) */
export const WALK_SPEED = 0.15;

/** Attente maximale entre deux promenades, en pas (3 secondes à x1) */
const MAX_WAIT = 30;

/**
 * La simulation des mortels : tout ce qui vit et change à chaque pas.
 * Pas de DOM ici : elle pourra un jour tourner dans un Web Worker.
 */
export class Simulation {
  readonly people = new People();
  private readonly random: Random;

  constructor(
    private readonly world: World,
    seed: number,
  ) {
    // Graine tirée de celle du monde : même graine => mêmes habitants, mêmes trajets
    this.random = new Random(seed ^ 0x5eed);
  }

  /**
   * Fait apparaître un groupe d'habitants autour d'une prairie choisie au hasard.
   * Renvoie le nombre d'habitants réellement placés.
   */
  spawnInitialGroup(count = INITIAL_PEOPLE): number {
    const start = this.findGrassTile();
    if (!start) return 0;

    let added = 0;
    for (let attempt = 0; attempt < count * 10 && added < count; attempt++) {
      const x = start.x + this.random.int(-3, 3);
      const y = start.y + this.random.int(-3, 3);
      if (this.isWalkable(x, y) && this.people.add(x, y) >= 0) {
        added++;
      }
    }
    return added;
  }

  /** Vrai si un mortel peut se tenir sur la tuile (x, y) */
  isWalkable(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && TERRAIN_INFO[this.world.getTerrain(x, y)].walkable;
  }

  /** Un pas de simulation */
  tick(): void {
    const people = this.people;
    // À l'envers, car remove() déplace le dernier habitant à la place du retiré
    for (let i = people.count - 1; i >= 0; i--) {
      // Le dieu a pu changer le terrain : un mortel sous l'eau ou dans la roche périt
      if (!this.isWalkable(Math.floor(people.x[i]), Math.floor(people.y[i]))) {
        people.remove(i);
        continue;
      }
      this.move(i);
    }
  }

  private move(i: number): void {
    const p = this.people;

    if (p.wait[i] > 0) {
      p.wait[i]--;
      return;
    }

    const dx = p.targetX[i] - p.x[i];
    const dy = p.targetY[i] - p.y[i];
    const distance = Math.hypot(dx, dy);

    if (distance <= WALK_SPEED) {
      // Arrivé : il se pose un moment, puis choisit une nouvelle destination
      p.x[i] = p.targetX[i];
      p.y[i] = p.targetY[i];
      p.wait[i] = this.random.int(0, MAX_WAIT);
      this.pickTarget(i);
      return;
    }

    // Un petit pas en ligne droite vers la destination
    const nextX = p.x[i] + (dx / distance) * WALK_SPEED;
    const nextY = p.y[i] + (dy / distance) * WALK_SPEED;
    if (this.isWalkable(Math.floor(nextX), Math.floor(nextY))) {
      p.x[i] = nextX;
      p.y[i] = nextY;
    } else {
      // Eau ou montagne sur le chemin : il change d'idée
      this.pickTarget(i);
    }
  }

  /** Choisit une tuile praticable proche comme prochaine destination */
  private pickTarget(i: number): void {
    const p = this.people;
    const x = Math.floor(p.x[i]);
    const y = Math.floor(p.y[i]);

    for (let attempt = 0; attempt < 8; attempt++) {
      const tx = x + this.random.int(-WANDER_RADIUS, WANDER_RADIUS);
      const ty = y + this.random.int(-WANDER_RADIUS, WANDER_RADIUS);
      if (this.isWalkable(tx, ty)) {
        p.targetX[i] = tx + 0.5;
        p.targetY[i] = ty + 0.5;
        return;
      }
    }

    // Rien trouvé : il reste sur place et réessaiera après sa pause
    p.targetX[i] = p.x[i];
    p.targetY[i] = p.y[i];
  }

  /** Une tuile de prairie au hasard, ou null si l'île n'en a pas */
  private findGrassTile(): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 2000; attempt++) {
      const x = this.random.int(0, this.world.width - 1);
      const y = this.random.int(0, this.world.height - 1);
      if (this.world.getTerrain(x, y) === Terrain.Grass) {
        return { x, y };
      }
    }
    return null;
  }
}