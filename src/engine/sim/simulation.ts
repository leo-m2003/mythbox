import { Random } from '../core/random';
import type { TileRect } from '../world/brushes';
import { Terrain, TERRAIN_INFO } from '../world/terrain';
import { World } from '../world/world';
import { Season, seasonAt } from './calendar';
import { Fire, SCORCH_TICKS } from './fire';
import { People } from './people';
import { TICKS_PER_DAY, TICKS_PER_MONTH, TICKS_PER_YEAR } from './sim-clock';
import { Villages } from './villages';

/** Nombre d'habitants au début d'un monde */
export const INITIAL_PEOPLE = 20;

/** Distance maximale d'une promenade, en tuiles */
export const WANDER_RADIUS = 6;

/** Vitesse de marche, en tuiles par pas (1,5 tuile par seconde à x1) */
export const WALK_SPEED = 0.15;

/** Attente maximale entre deux promenades, en pas (3 secondes à x1) */
const MAX_WAIT = 30;

/**
 * Faim à partir de laquelle un habitant cherche à manger (2 mois).
 * Une « portion » est donc une grosse réserve : la récolte d'une saison, pas un repas.
 */
export const HUNGRY_AT = 6 * TICKS_PER_MONTH;

/** Faim à laquelle un habitant meurt (4 mois sans manger) */
export const STARVATION = 12 * TICKS_PER_MONTH;

/** Faim effacée par une portion de nourriture */
export const PORTION_VALUE = 6 * TICKS_PER_MONTH;

/** Âge adulte : à partir de 16 ans, on peut avoir des enfants */
export const ADULT_AGE = 16 * TICKS_PER_YEAR;

/** Après 45 ans, plus d'enfants */
export const FERTILE_UNTIL = 45 * TICKS_PER_YEAR;

/** Durée de vie : entre 55 et 75 ans, tirée au hasard à la naissance */
const MIN_LIFESPAN = 55 * TICKS_PER_YEAR;
const MAX_LIFESPAN = 75 * TICKS_PER_YEAR;

/** Chance d'avoir un enfant à chaque pas, quand toutes les conditions sont réunies (en moyenne 1 an d'attente) */
const BIRTH_CHANCE = 1 / TICKS_PER_YEAR;

/** Délai minimal entre deux enfants d'un même parent : 2 ans */
export const BIRTH_COOLDOWN = 2 * TICKS_PER_YEAR;

/** Un enfant fatigue : la faim du parent augmente d'autant */
export const BIRTH_HUNGER = 3 * TICKS_PER_MONTH;

/** Distance maximale entre les deux adultes, en tuiles */
const PARTNER_DISTANCE = 2;

/** Rayon de la foudre, en tuiles, mesuré depuis le centre de la tuile frappée */
export const LIGHTNING_RADIUS = 1.5;

/** Rayon du pouvoir « Incendie », en tuiles : la tuile visée et ses 4 voisines */
export const FIRE_RADIUS = 1;

/** Humidité d'une forêt après l'incendie : sous FOREST_MOISTURE, elle redevient prairie */
export const BURNT_MOISTURE = 0.35;

/** Rayon de la pluie, en tuiles */
export const RAIN_RADIUS = 4;

/** Nourriture apportée par la pluie, en portions par seconde et par tuile (sans dépasser la capacité) */
export const RAIN_FOOD = 0.5;

/** La pluie efface la terre brûlée en 10 secondes, au lieu de SCORCH_TICKS pas */
export const RAIN_REGROWTH = SCORCH_TICKS / 10;

/** Rayon du séisme, en tuiles */
export const QUAKE_RADIUS = 6;

/** Chance de mourir pour un mortel à l'épicentre ; elle baisse jusqu'à 0 au bord du séisme */
export const QUAKE_DEADLINESS = 0.6;

/** Secousse du relief : variation d'altitude au plus, à l'épicentre */
export const QUAKE_JOLT = 0.05;

/** Profondeur de la faille en son milieu (en altitude) ; elle diminue vers ses deux bouts */
export const CRACK_DEPTH = 0.25;

/** Rayon de la fertilité, en tuiles */
export const FERTILITY_RADIUS = 5;

/** Chance qu'un adulte béni, en âge d'avoir des enfants, en ait un sur le champ */
export const BLESSED_BIRTH_CHANCE = 0.5;

/**
 * Ce qu'a fait un pouvoir. Il servira à calculer la foi gagnée ou perdue (v0.6)
 * et à écrire les mythes du Codex (v0.7).
 */
export interface PowerResult {
  /** Mortels tués sur le coup */
  victims: number;
  /** Tuiles enflammées */
  tilesIgnited: number;
  /** Tuiles dont le feu a été éteint */
  tilesExtinguished: number;
  /** Nourriture ajoutée, en portions */
  foodGiven: number;
  /** Tuiles dont le terrain a changé (une prairie devenue eau, une colline devenue montagne…) */
  terrainChanged: number;
  /** Enfants nés grâce au pouvoir */
  childrenBorn: number;
  /**
   * Village le plus touché, ou -1 : celui qui a perdu le plus d'habitants si le pouvoir a tué,
   * sinon celui qui a le plus d'habitants sous le pouvoir
   */
  mostAffectedVillage: number;
}

/** La clé qui a le plus grand nombre dans `counts`, ou -1 si `counts` est vide */
function mostCounted(counts: Map<number, number>): number {
  let best = -1;
  let most = 0;
  for (const [key, n] of counts) {
    if (n > most) {
      best = key;
      most = n;
    }
  }
  return best;
}

/** Un pouvoir qui n'a rien fait (encore) : chaque pouvoir part de là et le complète */
function noEffect(): PowerResult {
  return {
    victims: 0,
    tilesIgnited: 0,
    tilesExtinguished: 0,
    foodGiven: 0,
    terrainChanged: 0,
    childrenBorn: 0,
    mostAffectedVillage: -1,
  };
}

/** Un adulte sans village regarde autour de lui environ une fois par jour */
const VILLAGE_CHECK_CHANCE = 1 / TICKS_PER_DAY;

/** Distance à laquelle un adulte sans village rejoint un village existant, en tuiles */
export const JOIN_RADIUS = 6;

/** Pour fonder un village : au moins 5 adultes sans village, à 4 tuiles au plus du fondateur */
export const MIN_FOUNDERS = 5;
const FOUND_RADIUS = 4;

/** Distance minimale entre deux villages, en tuiles */
export const VILLAGE_SPACING = 12;

/** Au-delà de 40 habitants, le village est plein : des adultes partent, et il n'accueille plus personne */
export const MAX_VILLAGE_SIZE = 40;

/** Chance qu'un adulte d'un village plein, ou affamé, le quitte à chaque pas (en moyenne au bout d'un an) */
const LEAVE_CHANCE = 1 / TICKS_PER_YEAR;

/**
 * Repousse de la nourriture, en portions par pas, en moyenne sur l'année : une portion tous les 5 ans.
 * C'est elle qui fixe combien d'habitants l'île peut nourrir (voir le guide de l'étape 4).
 */
export const FOOD_REGROWTH = 1 / (5 * TICKS_PER_YEAR);

/**
 * La repousse selon la saison, en multiple de FOOD_REGROWTH : rapide au printemps, presque nulle l'hiver.
 * La moyenne vaut 1 : sur une année entière, la nourriture repousse autant qu'avant les saisons.
 */
export const SEASON_FOOD_GROWTH: Record<Season, number> = {
  [Season.Spring]: 1.7,
  [Season.Summer]: 1.3,
  [Season.Autumn]: 0.8,
  [Season.Winter]: 0.2,
};

/**
 * Nourriture maximale par type de terrain, rangée dans un petit tableau typé.
 * growFood() la lit pour chaque tuile à chaque pas : c'est bien plus rapide
 * que d'aller chercher TERRAIN_INFO[terrain].food 49 152 fois.
 * (Object.values parcourt les clés numériques 0 à 7 dans l'ordre : l'index est bien le terrain.)
 */
const FOOD_CAPACITY = Float32Array.from(Object.values(TERRAIN_INFO).map((info) => info.food));

/** Distance à laquelle un habitant affamé repère de la nourriture, en tuiles */
const FOOD_SEARCH_RADIUS = 8;

/**
 * La simulation des mortels : tout ce qui vit et change à chaque pas.
 * Pas de DOM ici : elle pourra un jour tourner dans un Web Worker.
 */
export class Simulation {
  readonly people = new People();
  readonly villages = new Villages();
  /** Nourriture disponible sur chaque tuile, en portions (même index que la grille du monde) */
  readonly food: Float32Array;
  readonly fire: Fire;
  private readonly random: Random;
  /** Nombre de pas joués depuis le début du monde : c'est lui qui donne la date et la saison */
  private elapsed = 0;

  /** Zone de la carte dont le terrain a changé depuis le dernier dessin (forêts brûlées, séismes), ou null */
  private dirty: TileRect | null = null;
  /** Créée une seule fois, pour ne pas fabriquer une nouvelle fonction à chaque pas */
  private readonly burnedOut = (i: number): void => this.onBurnedOut(i);

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
    this.fire = new Fire(world);
  }

  /** Nombre de pas joués depuis le début du monde */
  get ticks(): number {
    return this.elapsed;
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

      const i = this.people.add(x, y, this.randomLifespan());
      if (i < 0) break;
      // Des adultes de 16 à 30 ans, pour que le groupe puisse s'agrandir
      this.people.age[i] = this.random.int(ADULT_AGE, 30 * TICKS_PER_YEAR);
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

  /** Vrai si un mortel accepte d'avancer sur la tuile (x, y) : praticable et pas en feu */
  canStepOn(x: number, y: number): boolean {
    return this.isWalkable(x, y) && this.fire.burning[this.world.index(x, y)] === 0;
  }

  /** Vrai si l'habitant i a faim */
  isHungry(i: number): boolean {
    return this.people.hunger[i] >= HUNGRY_AT;
  }

  /** Un pas de simulation */
  tick(): void {
    this.growFood();
    this.fire.tick(this.random, this.burnedOut);

    const people = this.people;
    // À l'envers, car remove() déplace le dernier habitant à la place du retiré
    for (let i = people.count - 1; i >= 0; i--) {
      const x = Math.floor(people.x[i]);
      const y = Math.floor(people.y[i]);

      // Le dieu a pu changer le terrain : un mortel sous l'eau ou dans la roche périt
      if (!this.isWalkable(x, y)) {
        this.removePerson(i);
        continue;
      }

      // Pris dans les flammes
      if (this.fire.burning[this.world.index(x, y)] > 0) {
        this.removePerson(i);
        continue;
      }

      people.age[i]++;
      if (people.age[i] >= people.lifespan[i]) {
        // Mort de vieillesse
        this.removePerson(i);
        continue;
      }

      people.hunger[i]++;
      if (people.hunger[i] >= STARVATION) {
        this.removePerson(i);
        continue;
      }

      if (people.birthCooldown[i] > 0) {
        people.birthCooldown[i]--;
      } else {
        this.tryBirth(i);
      }

      this.updateVillage(i, x, y);

      // Affamé sur une tuile qui a de quoi manger : il mange au lieu de marcher
      if (this.isHungry(i) && this.eat(i, this.world.index(x, y))) {
        continue;
      }

      this.move(i);
    }
    this.elapsed++;
  }

  /**
   * La foudre de Zeus frappe la tuile (x, y) : les mortels à LIGHTNING_RADIUS tuiles au plus
   * meurent, la nourriture des tuiles touchées brûle, et la tuile frappée prend feu si elle le peut.
   */
  strikeLightning(x: number, y: number): PowerResult {
    const result = noEffect();
    // Personne n'échappe à la foudre
    const struck = this.peopleAround(x, y, LIGHTNING_RADIUS, () => 1);
    result.victims = struck.victims;
    result.mostAffectedVillage = struck.mostAffectedVillage;

    this.forEachTileAround(x, y, LIGHTNING_RADIUS, (i) => {
      this.food[i] = 0;
    });
    if (this.fire.ignite(this.world.index(x, y))) {
      result.tilesIgnited = 1;
    }
    return result;
  }

  /** Le pouvoir « Incendie » : met le feu à la tuile (x, y) et à ses voisines, si elles peuvent brûler */
  igniteFire(x: number, y: number): PowerResult {
    const result = noEffect();
    this.forEachTileAround(x, y, FIRE_RADIUS, (i) => {
      if (this.fire.ignite(i)) result.tilesIgnited++;
    });
    return result;
  }

  /**
   * La pluie tombe pendant `dt` secondes sur les tuiles à RAIN_RADIUS de (x, y) :
   * elle éteint le feu et mouille la terre (qui ne peut plus brûler pendant un mois),
   * fait repousser l'herbe sur la terre brûlée, et nourrit la terre.
   * Comme les pinceaux, elle suit le temps réel : on l'appelle à chaque image tant que le clic est maintenu.
   */
  rain(x: number, y: number, dt: number): PowerResult {
    const result = noEffect();
    // La pluie ne tue personne
    result.mostAffectedVillage = this.peopleAround(x, y, RAIN_RADIUS, () => 0).mostAffectedVillage;

    const fire = this.fire;
    // Au moins un pas par image, sinon une image très courte ne ferait rien du tout
    const regrowth = Math.max(1, Math.round(RAIN_REGROWTH * dt));
    this.forEachTileAround(x, y, RAIN_RADIUS, (i) => {
      // Mouillée, la tuile ne pourra pas reprendre feu tout de suite
      fire.soak(i);
      if (fire.burning[i] > 0) {
        fire.extinguish(i);
        result.tilesExtinguished++;
      } else if (fire.scorched[i] > 0) {
        // Rien ne pousse encore : la pluie raccourcit d'abord l'attente
        fire.regrow(i, regrowth);
      } else {
        const before = this.food[i];
        this.food[i] = Math.min(this.foodCapacity(i), before + RAIN_FOOD * dt);
        result.foodGiven += this.food[i] - before;
      }
    });
    return result;
  }

  /**
   * Le séisme frappe autour de la tuile (x, y) : une faille s'ouvre à travers l'épicentre,
   * le relief tremble, et les mortels proches peuvent mourir (d'autant plus près du centre).
   */
  quake(x: number, y: number): PowerResult {
    const result = noEffect();
    const world = this.world;
    // Le terrain d'avant, pour compter les tuiles qui ont changé
    const before = new Map<number, number>();
    this.forEachTileAround(x, y, QUAKE_RADIUS, (i) => before.set(i, world.terrain[i]));

    this.openCrack(x, y);

    // Le relief tremble : chaque tuile monte ou descend un peu, plus fort près de l'épicentre
    this.forEachTileAround(x, y, QUAKE_RADIUS, (i) => {
      const distance = Math.hypot((i % world.width) - x, Math.floor(i / world.width) - y);
      const jolt = QUAKE_JOLT * (1 - distance / (QUAKE_RADIUS + 1));
      world.elevation[i] = Math.min(
        1,
        Math.max(0, world.elevation[i] + this.random.range(-jolt, jolt)),
      );
      world.refreshTerrain(i);
    });

    for (const [i, terrain] of before) {
      if (world.terrain[i] !== terrain) result.terrainChanged++;
    }
    // L'ombrage d'une tuile dépend de ses voisines : on redessine une tuile de plus tout autour
    this.markDirtyAround(x, y, QUAKE_RADIUS + 1);

    // Les mortels, une fois le sol bouleversé : ceux qui sont tombés dans la faille (l'eau)
    // ou pris sous la roche meurent à coup sûr, les autres selon leur distance à l'épicentre
    const shaken = this.peopleAround(x, y, QUAKE_RADIUS, (distance, person) =>
      this.isWalkable(Math.floor(this.people.x[person]), Math.floor(this.people.y[person]))
        ? QUAKE_DEADLINESS * (1 - distance / QUAKE_RADIUS)
        : 1,
    );
    result.victims = shaken.victims;
    result.mostAffectedVillage = shaken.mostAffectedVillage;
    return result;
  }

  /**
   * La fertilité bénit la terre et les mortels autour de la tuile (x, y) :
   * la terre reverdit (même brûlée) et sa nourriture repousse d'un coup, les mortels sont rassasiés,
   * et chaque adulte en âge d'avoir des enfants a une chance sur deux d'en avoir un, sans partenaire.
   */
  bless(x: number, y: number): PowerResult {
    const result = noEffect();
    // La bénédiction ne tue personne
    result.mostAffectedVillage = this.peopleAround(
      x,
      y,
      FERTILITY_RADIUS,
      () => 0,
    ).mostAffectedVillage;

    this.forEachTileAround(x, y, FERTILITY_RADIUS, (i) => {
      this.fire.regrow(i, SCORCH_TICKS);
      const before = this.food[i];
      this.food[i] = this.foodCapacity(i);
      result.foodGiven += this.food[i] - before;
    });

    const p = this.people;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const radiusSquared = FERTILITY_RADIUS * FERTILITY_RADIUS;
    // Les enfants sont ajoutés à la fin du tableau : on ne parcourt que les habitants d'avant la bénédiction
    const count = p.count;
    for (let i = 0; i < count; i++) {
      const dx = p.x[i] - cx;
      const dy = p.y[i] - cy;
      if (dx * dx + dy * dy > radiusSquared) continue;

      // Le délai entre deux enfants est respecté : cliquer dix fois ne fait pas dix enfants
      const canHaveChild = p.birthCooldown[i] === 0 && this.isFertile(i);
      if (canHaveChild && this.random.chance(BLESSED_BIRTH_CHANCE) && this.giveBirth(i) >= 0) {
        result.childrenBorn++;
      }
      // Rassasié, même juste après avoir eu un enfant
      p.hunger[i] = 0;
    }
    return result;
  }

  /** Renvoie la zone dont le terrain a changé depuis le dernier appel (puis l'oublie), ou null */
  takeDirtyRect(): TileRect | null {
    const rect = this.dirty;
    this.dirty = null;
    return rect;
  }

  /**
   * Les mortels à `radius` tuiles au plus du centre de la tuile (x, y) subissent un pouvoir.
   * `deathChance(distance, person)` donne la chance de mourir du mortel n° person,
   * à `distance` tuiles du centre (1 = mort certaine, 0 = épargné).
   * Renvoie le nombre de victimes et le village le plus touché : celui qui a le plus de victimes,
   * ou, s'il n'y en a aucune, celui qui a le plus d'habitants dans la zone (-1 si personne n'a de village).
   */
  private peopleAround(
    x: number,
    y: number,
    radius: number,
    deathChance: (distance: number, person: number) => number,
  ): { victims: number; mostAffectedVillage: number } {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const radiusSquared = radius * radius;
    // Habitants et victimes par village (une Map suffit : il n'y en a que quelques-uns sous un pouvoir)
    const present = new Map<number, number>();
    const losses = new Map<number, number>();

    let victims = 0;
    const p = this.people;
    // À l'envers, comme dans tick(), car on peut retirer des habitants
    for (let i = p.count - 1; i >= 0; i--) {
      const dx = p.x[i] - cx;
      const dy = p.y[i] - cy;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared) continue;

      const village = p.village[i];
      if (village >= 0) present.set(village, (present.get(village) ?? 0) + 1);

      const chance = deathChance(Math.sqrt(distanceSquared), i);
      // Pas de tirage quand l'issue est certaine : le hasard de la simulation n'est pas consommé
      const dies = chance >= 1 || (chance > 0 && this.random.chance(chance));
      if (dies) {
        if (village >= 0) losses.set(village, (losses.get(village) ?? 0) + 1);
        this.removePerson(i);
        victims++;
      }
    }

    return { victims, mostAffectedVillage: mostCounted(victims > 0 ? losses : present) };
  }

  /** Appelle `action(i)` pour chaque tuile i du monde à `radius` tuiles au plus de (x, y) */
  private forEachTileAround(
    x: number,
    y: number,
    radius: number,
    action: (i: number) => void,
  ): void {
    const r = Math.ceil(radius);
    for (let ty = y - r; ty <= y + r; ty++) {
      for (let tx = x - r; tx <= x + r; tx++) {
        if (!this.world.inBounds(tx, ty)) continue;
        if ((tx - x) ** 2 + (ty - y) ** 2 <= radius * radius) {
          action(this.world.index(tx, ty));
        }
      }
    }
  }

  /** Une tuile vient de finir de brûler : plus de nourriture, et la forêt redevient prairie */
  private onBurnedOut(i: number): void {
    this.food[i] = 0;
    if (this.world.terrain[i] === Terrain.Forest) {
      this.world.moisture[i] = BURNT_MOISTURE;
      this.world.refreshTerrain(i);
      this.markDirty(i);
    }
  }

  /**
   * Ouvre une faille à travers l'épicentre (x, y) : une ligne un peu sinueuse, longue de deux rayons,
   * dont les tuiles s'enfoncent (le plus au milieu). Assez profonde, elle se remplit d'eau.
   */
  private openCrack(x: number, y: number): void {
    const world = this.world;
    const angle = this.random.range(0, Math.PI * 2);
    // Une tuile n'est creusée qu'une fois, même si la ligne repasse dessus
    const cracked = new Set<number>();

    // On part du centre et on avance dans les deux sens, par demi-tuiles
    for (const direction of [1, -1]) {
      let px = x + 0.5;
      let py = y + 0.5;
      let heading = angle;
      for (let step = 0; step <= QUAKE_RADIUS * 2; step++) {
        const tx = Math.floor(px);
        const ty = Math.floor(py);
        if (world.inBounds(tx, ty)) {
          const i = world.index(tx, ty);
          if (!cracked.has(i)) {
            cracked.add(i);
            // step / 2 : la distance au centre en tuiles
            const depth = CRACK_DEPTH * (1 - step / 2 / (QUAKE_RADIUS + 1));
            world.elevation[i] = Math.max(0, world.elevation[i] - depth);
          }
        }
        // La faille serpente un peu
        heading += this.random.range(-0.35, 0.35);
        px += Math.cos(heading) * 0.5 * direction;
        py += Math.sin(heading) * 0.5 * direction;
      }
    }
  }

  /** Agrandit la zone à redessiner pour inclure le carré de côté 2 × radius autour de (x, y) */
  private markDirtyAround(x: number, y: number, radius: number): void {
    const w = this.world;
    this.markDirty(w.index(Math.max(0, x - radius), Math.max(0, y - radius)));
    this.markDirty(w.index(Math.min(w.width - 1, x + radius), Math.min(w.height - 1, y + radius)));
  }

  /** Agrandit la zone à redessiner pour inclure la tuile i */
  private markDirty(i: number): void {
    const x = i % this.world.width;
    const y = Math.floor(i / this.world.width);
    const d = this.dirty;
    this.dirty = d
      ? {
          x0: Math.min(d.x0, x),
          y0: Math.min(d.y0, y),
          x1: Math.max(d.x1, x),
          y1: Math.max(d.y1, y),
        }
      : { x0: x, y0: y, x1: x, y1: y };
  }

  /** Vrai si l'habitant i est en âge d'avoir des enfants */
  isFertile(i: number): boolean {
    const age = this.people.age[i];
    return age >= ADULT_AGE && age < FERTILE_UNTIL;
  }

  /**
   * L'habitant i a peut-être un enfant : il faut qu'il soit en âge, rassasié,
   * avec un autre adulte tout près, et un peu de chance.
   * (Simplification : pas encore d'hommes et de femmes, ni de couples.)
   */
  private tryBirth(i: number): void {
    if (!this.isFertile(i) || this.isHungry(i)) return;
    // Le hasard d'abord : il évite de chercher un partenaire à chaque pas
    if (!this.random.chance(BIRTH_CHANCE)) return;
    if (!this.hasPartnerNear(i)) return;

    this.giveBirth(i);
  }

  /**
   * L'habitant i a un enfant, né sur sa tuile et dans son village.
   * Renvoie le numéro de l'enfant, ou -1 si le monde est plein.
   */
  private giveBirth(i: number): number {
    const p = this.people;
    const child = p.add(Math.floor(p.x[i]), Math.floor(p.y[i]), this.randomLifespan());
    if (child < 0) return -1; // le monde est plein

    // L'enfant naît dans le village de son parent
    const village = p.village[i];
    if (village >= 0) {
      p.village[child] = village;
      this.villages.join(village);
    }

    p.birthCooldown[i] = BIRTH_COOLDOWN;
    p.hunger[i] = Math.min(STARVATION - 1, p.hunger[i] + BIRTH_HUNGER);
    return child;
  }

  /** Vrai si un autre adulte se trouve à moins de PARTNER_DISTANCE tuiles de l'habitant i */
  private hasPartnerNear(i: number): boolean {
    const p = this.people;
    const maxSquared = PARTNER_DISTANCE * PARTNER_DISTANCE;
    // Parcourt tout le monde : acceptable, car on ne le fait que rarement (après le tirage au sort)
    for (let j = 0; j < p.count; j++) {
      if (j === i || p.age[j] < ADULT_AGE) continue;
      const dx = p.x[j] - p.x[i];
      const dy = p.y[j] - p.y[i];
      if (dx * dx + dy * dy <= maxSquared) return true;
    }
    return false;
  }

  /** Retire l'habitant i, en le décomptant de son village */
  private removePerson(i: number): void {
    const village = this.people.village[i];
    if (village >= 0) {
      this.villages.leave(village);
    }
    this.people.remove(i);
  }

  /**
   * La vie de village d'un adulte :
   * - si le village est plein, ou s'il y a faim, il finit par partir chercher mieux ailleurs ;
   * - sans village et rassasié, environ une fois par jour, il en rejoint un proche ou tente d'en fonder un.
   * (Les enfants restent dans le village où ils sont nés.)
   */
  private updateVillage(i: number, x: number, y: number): void {
    const p = this.people;
    if (p.age[i] < ADULT_AGE) return;

    const village = p.village[i];
    if (village >= 0) {
      const crowded = this.villages.population[village] > MAX_VILLAGE_SIZE;
      if ((crowded || this.isHungry(i)) && this.random.chance(LEAVE_CHANCE)) {
        p.village[i] = -1;
        this.villages.leave(village);
      }
      return;
    }

    if (this.isHungry(i) || !this.random.chance(VILLAGE_CHECK_CHANCE)) return;

    const near = this.villages.nearest(x, y, JOIN_RADIUS);
    if (near >= 0) {
      // Un village plein n'accueille personne : il faudra aller plus loin
      if (this.villages.population[near] < MAX_VILLAGE_SIZE) {
        p.village[i] = near;
        this.villages.join(near);
      }
      return;
    }

    this.tryFoundVillage(x, y);
  }

  /**
   * Fonde un village sur la tuile (x, y) s'il y a assez d'adultes sans village autour,
   * sur une prairie, loin des autres villages.
   * Tous ceux qui sont autour, enfants compris, en deviennent les habitants.
   */
  private tryFoundVillage(x: number, y: number): void {
    if (this.world.getTerrain(x, y) !== Terrain.Grass) return;
    if (this.villages.nearest(x, y, VILLAGE_SPACING) >= 0) return;
    if (this.countFoundersNear(x, y) < MIN_FOUNDERS) return;

    const village = this.villages.found(x, y);
    if (village < 0) return; // plus de place pour un village

    const p = this.people;
    for (let j = 0; j < p.count; j++) {
      if (p.village[j] < 0 && this.isNearTile(j, x, y, FOUND_RADIUS)) {
        p.village[j] = village;
        this.villages.join(village);
      }
    }
  }

  /** Nombre d'adultes sans village à FOUND_RADIUS tuiles au plus de (x, y), le fondateur compris */
  private countFoundersNear(x: number, y: number): number {
    const p = this.people;
    let count = 0;
    for (let j = 0; j < p.count; j++) {
      if (p.village[j] < 0 && p.age[j] >= ADULT_AGE && this.isNearTile(j, x, y, FOUND_RADIUS)) {
        count++;
      }
    }
    return count;
  }

  /** Vrai si l'habitant j est à `radius` tuiles au plus du centre de la tuile (x, y), sur chaque axe */
  private isNearTile(j: number, x: number, y: number, radius: number): boolean {
    const p = this.people;
    return Math.abs(p.x[j] - (x + 0.5)) <= radius && Math.abs(p.y[j] - (y + 0.5)) <= radius;
  }

  private randomLifespan(): number {
    return this.random.int(MIN_LIFESPAN, MAX_LIFESPAN);
  }

  /** Nourriture maximale de la tuile i, selon son terrain actuel */
  private foodCapacity(i: number): number {
    return FOOD_CAPACITY[this.world.terrain[i]];
  }

  /**
   * La nourriture repousse doucement, plus ou moins vite selon la saison,
   * sans dépasser ce que le terrain peut porter.
   * Sur la terre brûlée, rien ne repousse tant qu'elle n'a pas récupéré.
   */
  private growFood(): void {
    const regrowth = FOOD_REGROWTH * SEASON_FOOD_GROWTH[seasonAt(this.elapsed)];
    const food = this.food;
    const terrain = this.world.terrain;
    const scorched = this.fire.scorched;
    for (let i = 0; i < food.length; i++) {
      if (scorched[i] > 0) continue;
      // Un pinceau a pu réduire la capacité (forêt défrichée, prairie inondée…)
      food[i] = Math.min(FOOD_CAPACITY[terrain[i]], food[i] + regrowth);
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
    if (this.canStepOn(Math.floor(nextX), Math.floor(nextY))) {
      p.x[i] = nextX;
      p.y[i] = nextY;
    } else {
      // Eau, montagne ou feu sur le chemin : il part ailleurs, au hasard.
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

  /** Choisit une destination de promenade : autour de son village s'il en a un, sinon autour de lui */
  private wander(i: number): void {
    const p = this.people;
    const village = p.village[i];
    const x = village >= 0 ? this.villages.x[village] : Math.floor(p.x[i]);
    const y = village >= 0 ? this.villages.y[village] : Math.floor(p.y[i]);

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
