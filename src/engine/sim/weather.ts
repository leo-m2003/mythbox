import { Random } from '../core/random';
import { Season, seasonAt } from './calendar';
import { TICKS_PER_DAY, TICKS_PER_MONTH } from './sim-clock';

/**
 * Nombre de nuages vers lequel tend le ciel, pour 10 000 tuiles, selon la saison :
 * peu l'été, beaucoup l'hiver. Sur la carte de 256 × 192 tuiles : 8, 4, 10 et 12 nuages.
 */
export const SEASON_CLOUDS: Record<Season, number> = {
  [Season.Spring]: 1.6,
  [Season.Summer]: 0.8,
  [Season.Autumn]: 2,
  [Season.Winter]: 2.4,
};

/** Rayon d'un nuage, en tuiles */
export const MIN_CLOUD_RADIUS = 4;
export const MAX_CLOUD_RADIUS = 9;

/** Durée de vie d'un nuage, en pas : de 3 à 8 mois (30 à 80 secondes à x1) */
export const MIN_CLOUD_LIFE = 3 * TICKS_PER_MONTH;
export const MAX_CLOUD_LIFE = 8 * TICKS_PER_MONTH;

/** Part de sa vie pendant laquelle un nuage se forme, puis se dissipe */
const CLOUD_FADE_PART = 0.15;

/** Chance, à chaque pas, qu'un nuage se forme quand le ciel en manque (en moyenne un tous les 2 jours) */
const CLOUD_FORM_CHANCE = 1 / (2 * TICKS_PER_DAY);

/** Vitesse du vent, en tuiles par pas (de 0,2 à 0,6 tuile par seconde à x1) */
export const MIN_WIND_SPEED = 0.02;
export const MAX_WIND_SPEED = 0.06;

/** Le vent tourne une fois par jour, d'au plus cet angle (en radians, environ 11°) */
export const MAX_WIND_TURN = 0.2;

/** Chance qu'un nouveau nuage soit un nuage de pluie, selon la saison : peu l'été, la saison sèche */
export const SEASON_RAIN: Record<Season, number> = {
  [Season.Spring]: 0.4,
  [Season.Summer]: 0.1,
  [Season.Autumn]: 0.5,
  [Season.Winter]: 0.4,
};

/**
 * Chance qu'un nouveau nuage soit un orage, selon la saison : surtout l'été.
 * C'est indépendant de la pluie : un orage d'été est le plus souvent sec, et sa foudre allume des incendies.
 * Sous un orage qui pleut, la terre est mouillée et ne prend pas feu.
 */
export const SEASON_STORMS: Record<Season, number> = {
  [Season.Spring]: 0.05,
  [Season.Summer]: 0.4,
  [Season.Autumn]: 0.05,
  [Season.Winter]: 0,
};

/** La pluie et la foudre tombent sous le cœur du nuage : un disque de cette part de son rayon */
const RAIN_PART = 0.6;

/** Chance, à chaque pas, que la foudre tombe sous un orage (en moyenne une fois tous les 6 jours) */
export const STRIKE_CHANCE = 1 / (6 * TICKS_PER_DAY);

/**
 * Chance qu'un coup de foudre du ciel allume un feu, selon la saison : la terre sèche de l'été
 * prend plus facilement. La sécheresse de l'étape 4 pourra l'augmenter.
 */
export const SEASON_IGNITION: Record<Season, number> = {
  [Season.Spring]: 0.1,
  [Season.Summer]: 0.3,
  [Season.Autumn]: 0.1,
  [Season.Winter]: 0.05,
};

/** Un nuage. Sa position est celle de son ombre au sol : le nuage lui-même est dessiné plus haut */
export interface Cloud {
  /** Centre de l'ombre, en tuiles */
  x: number;
  y: number;
  /** Rayon, en tuiles */
  radius: number;
  /** Étirement horizontal de la forme (1 = sans étirement) */
  stretch: number;
  /** Forme retournée de gauche à droite : deux nuages voisins ne se ressemblent pas */
  mirrored: boolean;
  /** Il pleut sous ce nuage */
  rain: boolean;
  /** Un orage : la foudre tombe sous ce nuage */
  storm: boolean;
  /** Âge et durée de vie, en pas */
  age: number;
  life: number;
}

/** Opacité d'un nuage, de 0 à 1 : il se forme peu à peu, puis se dissipe à la fin de sa vie */
export function cloudOpacity(cloud: Cloud): number {
  const fade = cloud.life * CLOUD_FADE_PART;
  return Math.max(0, Math.min(1, cloud.age / fade, (cloud.life - cloud.age) / fade));
}

/** Un nuage ne pleut et ne gronde qu'une fois formé, et plus dès qu'il commence à se dissiper */
function isFormed(cloud: Cloud): boolean {
  return cloudOpacity(cloud) === 1;
}

/** Vrai s'il pleut sous le nuage en ce moment */
export function isRaining(cloud: Cloud): boolean {
  return cloud.rain && isFormed(cloud);
}

/** Rayon du disque où tombent la pluie et la foudre, sous le nuage, en tuiles */
export function rainRadius(cloud: Cloud): number {
  return cloud.radius * RAIN_PART;
}

/** Une tuile frappée par la foudre */
export interface Strike {
  x: number;
  y: number;
  /** Vrai si la foudre allume un feu (quand la tuile peut brûler) */
  ignites: boolean;
}

/**
 * Le temps qu'il fait : le vent, les nuages qu'il pousse, et la foudre des orages.
 * Pas de DOM ici : la simulation la fait avancer à chaque pas et applique la pluie et la foudre
 * au monde, le rendu la dessine.
 */
export class Weather {
  readonly clouds: Cloud[] = [];
  /** Direction du vent, en radians (0 = vers l'est, π/2 = vers le sud) */
  windAngle: number;
  /** Vitesse du vent, en tuiles par pas */
  windSpeed: number;
  /** Les tuiles frappées par la foudre pendant le dernier pas */
  readonly strikes: Strike[] = [];
  private readonly random: Random;

  constructor(
    private readonly width: number,
    private readonly height: number,
    seed: number,
  ) {
    // Un hasard à part : un nuage de plus ne change pas les trajets des mortels
    this.random = new Random(seed);
    this.windAngle = this.random.range(0, Math.PI * 2);
    this.windSpeed = this.random.range(MIN_WIND_SPEED, MAX_WIND_SPEED);

    // Le monde naît avec le ciel du printemps, des nuages à tous les âges
    for (let n = 0; n < this.cloudTarget(Season.Spring); n++) {
      const cloud = this.formCloud(0);
      cloud.age = this.random.int(0, cloud.life - 1);
    }
  }

  /** Déplacement du vent à chaque pas, en tuiles */
  get windX(): number {
    return Math.cos(this.windAngle) * this.windSpeed;
  }

  get windY(): number {
    return Math.sin(this.windAngle) * this.windSpeed;
  }

  /** Un pas de météo. `tick` est le numéro du pas, qui donne la saison */
  tick(tick: number): void {
    this.strikes.length = 0;
    if (tick % TICKS_PER_DAY === 0) {
      this.turnWind();
    }

    const dx = this.windX;
    const dy = this.windY;
    // À l'envers, car on retire des nuages en cours de route
    for (let k = this.clouds.length - 1; k >= 0; k--) {
      const cloud = this.clouds[k];
      cloud.x += dx;
      cloud.y += dy;
      cloud.age++;
      if (cloud.age >= cloud.life || this.isOffMap(cloud)) {
        this.clouds.splice(k, 1);
        continue;
      }
      // Sous un orage, la foudre tombe de temps en temps
      if (cloud.storm && isFormed(cloud) && this.random.chance(STRIKE_CHANCE)) {
        this.strike(cloud, seasonAt(tick));
      }
    }

    // Le ciel tend vers le nombre de nuages de la saison : un nouveau se forme de temps en temps
    if (
      this.clouds.length < this.cloudTarget(seasonAt(tick)) &&
      this.random.chance(CLOUD_FORM_CHANCE)
    ) {
      this.formCloud(tick);
    }
  }

  /** Nombre de nuages vers lequel tend le ciel à cette saison, selon la taille de la carte */
  cloudTarget(season: Season): number {
    return Math.round((SEASON_CLOUDS[season] * this.width * this.height) / 10_000);
  }

  /** Le vent tourne un peu et change un peu de force */
  private turnWind(): void {
    this.windAngle += this.random.range(-MAX_WIND_TURN, MAX_WIND_TURN);
    const gust = (MAX_WIND_SPEED - MIN_WIND_SPEED) * 0.1;
    this.windSpeed = Math.min(
      MAX_WIND_SPEED,
      Math.max(MIN_WIND_SPEED, this.windSpeed + this.random.range(-gust, gust)),
    );
  }

  /**
   * La foudre tombe sur une tuile au hasard sous l'orage, si elle est dans la carte.
   * Les tuiles possibles sont celles que la pluie arrose : à rainRadius du centre de la tuile du nuage.
   */
  private strike(cloud: Cloud, season: Season): void {
    const radius = rainRadius(cloud);
    const r = Math.floor(radius);
    // Une tuile au hasard dans le carré autour du nuage, jusqu'à en trouver une dans le disque
    let dx: number;
    let dy: number;
    do {
      dx = this.random.int(-r, r);
      dy = this.random.int(-r, r);
    } while (dx * dx + dy * dy > radius * radius);
    const x = Math.floor(cloud.x) + dx;
    const y = Math.floor(cloud.y) + dy;
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.strikes.push({ x, y, ignites: this.random.chance(SEASON_IGNITION[season]) });
    }
  }

  /**
   * Un nouveau nuage se forme quelque part au-dessus du monde, au pas `tick`.
   * Il pleut ou gronde selon la saison du milieu de sa vie : c'est là qu'on le verra le plus.
   */
  private formCloud(tick: number): Cloud {
    const life = this.random.int(MIN_CLOUD_LIFE, MAX_CLOUD_LIFE);
    const season = seasonAt(tick + life / 2);
    const cloud: Cloud = {
      x: this.random.range(0, this.width),
      y: this.random.range(0, this.height),
      radius: this.random.range(MIN_CLOUD_RADIUS, MAX_CLOUD_RADIUS),
      stretch: this.random.range(1, 1.4),
      mirrored: this.random.chance(0.5),
      rain: this.random.chance(SEASON_RAIN[season]),
      storm: this.random.chance(SEASON_STORMS[season]),
      age: 0,
      life,
    };
    this.clouds.push(cloud);
    return cloud;
  }

  /** Vrai si le nuage est sorti de la carte, poussé par le vent */
  private isOffMap(cloud: Cloud): boolean {
    const margin = cloud.radius * 2;
    return (
      cloud.x < -margin ||
      cloud.y < -margin ||
      cloud.x > this.width + margin ||
      cloud.y > this.height + margin
    );
  }
}
