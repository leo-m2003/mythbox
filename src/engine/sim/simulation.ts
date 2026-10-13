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

/** Faim à partir de laquelle un habitant cherche à manger (20 jours) */
export const HUNGRY_AT = 200;

/** Faim à laquelle un habitant meurt (40 jours sans manger) */
export const STARVATION = 400;

/** Faim effacée par une portion de nourriture */
export const PORTION_VALUE = 200;

/** Repousse de la nourriture, en portions par pas (une portion tous les 20 jours) */
export const FOOD_REGROWTH = 1 / 200;

/**
 * Nourriture maximale par type de terrain, rangée dans un petit tableau typé.
 * growFood() la lit pour chaque tuile à chaque pas : c'est bien plus rapide
 * que d'aller chercher TERRAIN_INFO[terrain].food 49 152 fois.
 * (Object.values parcourt les clés numériques 0 à 7 dans l'ordre : l'index est bien le terrain.)
 */
const FOOD_CAPACITY = Float32Array.from(
  Object.values(TERRAIN_INFO).map((info) => info.food),
);

/** Distance à laquelle un habitant affamé repère de la nourriture, en tuiles */
const FOOD_SEARCH_RADIUS = 8;

/**
 * La simulation des mortels : tout ce qui vit et change à chaque pas.
 * Pas de DOM ici : elle pourra un jour tourner dans un Web Worker.
 */
export class Simulation {
  readonly people = new People();
  /** Nourriture disponible sur chaque tuile, en portions (même index que la grille du monde) */
  readonly food: Float32Array;
  private readonly random: Random;

  constructor(
    private readonly world: World,
    seed: number,
  ) {
    // Graine tirée de celle du monde : même graine => mêmes habitants, mêmes trajets
    this.random = new Random(seed ^ 0x5eed);

    // Au début du monde, chaque tuile porte toute la nourriture possible
    this.food = new Float32Array(world.size);
    for (let i = 0; i < world.size; i++) {
      this.food[i] = this.foodCapacity(i);
    }
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
      if (!this.isWalkable(x, y)) continue;

      const i = this.people.add(x, y);
      if (i < 0) break;
      // Faims différentes : ils n'iront pas tous manger au même moment
      this.people.hunger[i] = this.random.int(0, HUNGRY_AT - 1);
      added++;
    }
    return added;
  }

  /** Vrai si un mortel peut se tenir sur la tuile (x, y) */
  isWalkable(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && TERRAIN_INFO[this.world.getTerrain(x, y)].walkable;
  }

  /** Vrai si l'habitant i a faim */
  isHungry(i: number): boolean {
    return this.people.hunger[i] >= HUNGRY_AT;
  }

  /** Un pas de simulation */
  tick(): void {
    this.growFood();

    const people = this.people;
    // À l'envers, car remove() déplace le dernier habitant à la place du retiré
    for (let i = people.count - 1; i >= 0; i--) {
      const x = Math.floor(people.x[i]);
      const y = Math.floor(people.y[i]);

      // Le dieu a pu changer le terrain : un mortel sous l'eau ou dans la roche périt
      if (!this.isWalkable(x, y)) {
        people.remove(i);
        continue;
      }

      people.hunger[i]++;
      if (people.hunger[i] >= STARVATION) {
        people.remove(i);
        continue;
      }

      // Affamé sur une tuile qui a de quoi manger : il mange au lieu de marcher
      if (this.isHungry(i) && this.eat(i, this.world.index(x, y))) {
        continue;
      }

      this.move(i);
    }
  }

  /** Nourriture maximale de la tuile i, selon son terrain actuel */
  private foodCapacity(i: number): number {
    return FOOD_CAPACITY[this.world.terrain[i]];
  }

  /** La nourriture repousse doucement, sans dépasser ce que le terrain peut porter */
  private growFood(): void {
    const food = this.food;
    const terrain = this.world.terrain;
    for (let i = 0; i < food.length; i++) {
      // Un pinceau a pu réduire la capacité (forêt défrichée, prairie inondée…)
      food[i] = Math.min(FOOD_CAPACITY[terrain[i]], food[i] + FOOD_REGROWTH);
    }
  }

  /** L'habitant i mange une portion sur la tuile `tile`, s'il y en a une. Renvoie vrai s'il a mangé */
  private eat(i: number, tile: number): boolean {
    if (this.food[tile] < 1) return false;

    this.food[tile] -= 1;
    const p = this.people;
    p.hunger[i] = Math.max(0, p.hunger[i] - PORTION_VALUE);
    return true;
  }

  private move(i: number): void {
    const p = this.people;
    const hungry = this.isHungry(i);

    if (p.wait[i] > 0) {
      // Un affamé ne flâne pas
      p.wait[i] = hungry ? 0 : p.wait[i] - 1;
      if (!hungry) return;
    }

    const dx = p.targetX[i] - p.x[i];
    const dy = p.targetY[i] - p.y[i];
    const distance = Math.hypot(dx, dy);

    if (distance <= WALK_SPEED) {
      // Arrivé : il se pose un moment (sauf s'il a faim), puis choisit une nouvelle destination
      p.x[i] = p.targetX[i];
      p.y[i] = p.targetY[i];
      p.wait[i] = hungry ? 0 : this.random.int(0, MAX_WAIT);
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
      // Eau ou montagne sur le chemin : il part ailleurs, au hasard.
      // (Viser à nouveau la même nourriture le bloquerait contre l'obstacle.)
      this.wander(i);
    }
  }

  /** Choisit la prochaine destination : de quoi manger s'il a faim, sinon une promenade */
  private pickTarget(i: number): void {
    const p = this.people;
    const x = Math.floor(p.x[i]);
    const y = Math.floor(p.y[i]);

    if (this.isHungry(i)) {
      const food = this.findFood(x, y);
      if (food) {
        p.targetX[i] = food.x + 0.5;
        p.targetY[i] = food.y + 0.5;
        return;
      }
      // Rien à manger en vue : il part explorer au hasard
    }

    this.wander(i);
  }

  /** Choisit une tuile praticable proche comme destination de promenade */
  private wander(i: number): void {
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

  /** La tuile la plus proche de (x, y) qui a au moins une portion, ou null */
  private findFood(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;

    for (let ty = y - FOOD_SEARCH_RADIUS; ty <= y + FOOD_SEARCH_RADIUS; ty++) {
      for (let tx = x - FOOD_SEARCH_RADIUS; tx <= x + FOOD_SEARCH_RADIUS; tx++) {
        if (!this.world.inBounds(tx, ty)) continue;
        if (this.food[this.world.index(tx, ty)] < 1) continue;

        // Distance au carré : suffit pour comparer, sans racine carrée
        const distance = (tx - x) ** 2 + (ty - y) ** 2;
        if (distance < bestDistance) {
          best = { x: tx, y: ty };
          bestDistance = distance;
        }
      }
    }
    return best;
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