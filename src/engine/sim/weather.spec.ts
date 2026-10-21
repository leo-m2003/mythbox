import { describe, it, expect } from 'vitest';
import { SNOW_HEIGHT } from '../world/terrain-rules';
import { Season, seasonAt, TICKS_PER_SEASON } from './calendar';
import { TICKS_PER_DAY, TICKS_PER_MONTH, TICKS_PER_YEAR } from './sim-clock';
import {
  cloudOpacity,
  DROUGHT_IGNITION,
  DROUGHT_TICKS,
  DRYING_TICKS,
  isRaining,
  MAX_CLOUD_RADIUS,
  MAX_WIND_SPEED,
  MAX_WIND_TURN,
  MIN_WIND_SPEED,
  rainRadius,
  SEASON_IGNITION,
  SNOWFALL_TICKS,
  THAW_TICKS,
  Weather,
  WINTER_SNOW_LINE,
  type Cloud,
} from './weather';

/** La météo d'une carte de 256 × 192 tuiles */
function weather(seed = 1): Weather {
  return new Weather(256, 192, seed);
}

/** Fait avancer la météo de `ticks` pas, à partir du pas `from` */
function run(w: Weather, ticks: number, from = 0): void {
  for (let t = from; t < from + ticks; t++) w.tick(t);
}

describe('Météo', () => {
  it('commence avec les nuages du printemps, à des âges différents', () => {
    const w = weather();
    expect(w.cloudTarget(Season.Spring)).toBe(8);
    expect(w.clouds.length).toBe(8);
    const ages = new Set(w.clouds.map((cloud) => cloud.age));
    expect(ages.size).toBeGreaterThan(1);
  });

  it('pousse tous les nuages avec le vent', () => {
    const w = weather();
    const before = w.clouds.map((cloud) => ({ cloud, x: cloud.x, y: cloud.y }));
    const { windX, windY } = w;
    // Le pas 1 n'est pas un début de journée : le vent ne tourne pas
    w.tick(1);
    for (const { cloud, x, y } of before) {
      if (!w.clouds.includes(cloud)) continue;
      expect(cloud.x).toBeCloseTo(x + windX, 5);
      expect(cloud.y).toBeCloseTo(y + windY, 5);
    }
  });

  it('fait tourner le vent doucement, une fois par jour', () => {
    const w = weather();
    for (let day = 0; day < 200; day++) {
      const angle = w.windAngle;
      // Pendant la journée, le vent ne bouge pas
      run(w, TICKS_PER_DAY - 1, day * TICKS_PER_DAY + 1);
      expect(w.windAngle).toBe(angle);
      // Au début de la suivante, il tourne un peu
      w.tick((day + 1) * TICKS_PER_DAY);
      expect(Math.abs(w.windAngle - angle)).toBeLessThanOrEqual(MAX_WIND_TURN);
      expect(w.windSpeed).toBeGreaterThanOrEqual(MIN_WIND_SPEED);
      expect(w.windSpeed).toBeLessThanOrEqual(MAX_WIND_SPEED);
    }
  });

  it('forme les nuages peu à peu, puis les dissipe', () => {
    const cloud: Cloud = {
      x: 0,
      y: 0,
      radius: 5,
      stretch: 1,
      mirrored: false,
      rain: false,
      storm: false,
      age: 0,
      life: 400,
    };
    expect(cloudOpacity(cloud)).toBe(0);
    cloud.age = 30;
    expect(cloudOpacity(cloud)).toBeCloseTo(0.5, 5);
    cloud.age = 200;
    expect(cloudOpacity(cloud)).toBe(1);
    cloud.age = 370;
    expect(cloudOpacity(cloud)).toBeCloseTo(0.5, 5);
    cloud.age = 400;
    expect(cloudOpacity(cloud)).toBe(0);
  });

  it('ne pleut que sous un nuage de pluie formé', () => {
    const cloud: Cloud = {
      x: 0,
      y: 0,
      radius: 5,
      stretch: 1,
      mirrored: false,
      rain: true,
      storm: false,
      age: 30,
      life: 400,
    };
    // Il se forme encore, puis il est formé, puis il se dissipe
    expect(isRaining(cloud)).toBe(false);
    cloud.age = 200;
    expect(isRaining(cloud)).toBe(true);
    cloud.age = 370;
    expect(isRaining(cloud)).toBe(false);
    // Un nuage de beau temps ne pleut jamais
    cloud.age = 200;
    cloud.rain = false;
    expect(isRaining(cloud)).toBe(false);
    // La pluie tombe sous le cœur du nuage
    expect(rainRadius(cloud)).toBeCloseTo(3, 5);
  });

  it('fait tomber la foudre sous les orages, dans la carte, surtout l’été', () => {
    const w = weather();
    const strikes = [0, 0, 0, 0];
    for (let t = 0; t < 20 * TICKS_PER_YEAR; t++) {
      w.tick(t);
      for (const strike of w.strikes) {
        strikes[seasonAt(t)]++;
        expect(strike.x).toBeGreaterThanOrEqual(0);
        expect(strike.x).toBeLessThan(256);
        expect(strike.y).toBeGreaterThanOrEqual(0);
        expect(strike.y).toBeLessThan(192);
        // Sous un orage, dans le disque de pluie (à une tuile près : la foudre tombe sur une tuile entière)
        const underStorm = w.clouds.some(
          (cloud) =>
            cloud.storm &&
            Math.hypot(strike.x + 0.5 - cloud.x, strike.y + 0.5 - cloud.y) <= rainRadius(cloud) + 1,
        );
        expect(underStorm).toBe(true);
      }
    }
    expect(strikes[Season.Summer]).toBeGreaterThan(2 * strikes[Season.Spring]);
    expect(strikes[Season.Summer]).toBeGreaterThan(2 * strikes[Season.Winter]);
  });

  it('n’allume pas toujours de feu, et plus souvent l’été', () => {
    const w = weather();
    const strikes = [0, 0, 0, 0];
    const fires = [0, 0, 0, 0];
    for (let t = 0; t < 20 * TICKS_PER_YEAR; t++) {
      // Il pleut sur l'île à chaque pas : jamais de sécheresse
      w.rainFell();
      w.tick(t);
      for (const strike of w.strikes) {
        strikes[seasonAt(t)]++;
        if (strike.ignites) fires[seasonAt(t)]++;
      }
    }
    // L'été, environ SEASON_IGNITION[Season.Summer] des coups de foudre allument un feu
    const summer = fires[Season.Summer] / strikes[Season.Summer];
    expect(summer).toBeGreaterThan(SEASON_IGNITION[Season.Summer] - 0.1);
    expect(summer).toBeLessThan(SEASON_IGNITION[Season.Summer] + 0.1);
    // Plus de feux l'été que pendant tout le reste de l'année
    expect(fires[Season.Summer]).toBeGreaterThan(
      fires[Season.Spring] + fires[Season.Autumn] + fires[Season.Winter],
    );
  });

  it('tourne à la sécheresse après une saison sans pluie sur l’île, mais seulement l’été', () => {
    const w = weather();
    // Tout le printemps sans pluie : pas encore de sécheresse, ce n'est pas l'été
    run(w, TICKS_PER_SEASON);
    expect(w.dryTicks).toBe(DROUGHT_TICKS);
    expect(w.drought).toBe(false);
    // Le premier jour de l'été
    w.tick(TICKS_PER_SEASON);
    expect(w.drought).toBe(true);
  });

  it('ne tourne pas à la sécheresse quand il pleut sur l’île de temps en temps', () => {
    const w = weather();
    for (let t = 0; t < 2 * TICKS_PER_YEAR; t++) {
      w.tick(t);
      // Une pluie par mois
      if (t % TICKS_PER_MONTH === 0) w.rainFell();
    }
    expect(w.drought).toBe(false);
    expect(w.dryness).toBe(0);
  });

  it('dessèche la terre peu à peu, et la pluie brise la sécheresse', () => {
    const w = weather();
    // Un printemps sans pluie : la sécheresse commence le premier jour de l'été
    run(w, TICKS_PER_SEASON + 1);
    expect(w.drought).toBe(true);
    // La terre sèche en DRYING_TICKS pas : à moitié au bout de la moitié
    run(w, DRYING_TICKS / 2 - 1, TICKS_PER_SEASON + 1);
    expect(w.dryness).toBeCloseTo(0.5);
    run(w, DRYING_TICKS, TICKS_PER_SEASON + DRYING_TICKS / 2);
    expect(w.dryness).toBe(1);

    // Il pleut sur l'île : la sécheresse est brisée, et la terre reverdit à la même vitesse
    w.rainFell();
    expect(w.drought).toBe(false);
    const rained = TICKS_PER_SEASON + (3 * DRYING_TICKS) / 2;
    run(w, DRYING_TICKS / 2, rained);
    expect(w.dryness).toBeCloseTo(0.5);
    run(w, DRYING_TICKS, rained + DRYING_TICKS / 2);
    expect(w.dryness).toBe(0);
    expect(w.drought).toBe(false);
  });

  it('allume plus de feux quand la terre est sèche, sans changer la suite du hasard', () => {
    // La même météo deux fois : sur l'une, il pleut sur l'île à chaque pas, sur l'autre jamais
    const wet = weather();
    const dry = weather();
    let strikes = 0;
    let wetFires = 0;
    let dryFires = 0;
    for (let t = 0; t < 20 * TICKS_PER_YEAR; t++) {
      wet.rainFell();
      wet.tick(t);
      dry.tick(t);
      // La foudre tombe aux mêmes endroits : seul le feu change
      expect(dry.strikes.length).toBe(wet.strikes.length);
      if (seasonAt(t) !== Season.Summer) continue;
      strikes += dry.strikes.length;
      wetFires += wet.strikes.filter((strike) => strike.ignites).length;
      dryFires += dry.strikes.filter((strike) => strike.ignites).length;
    }
    // L'été, sur la terre desséchée, environ DROUGHT_IGNITION fois plus de feux
    const ratio = dryFires / strikes;
    const expected = SEASON_IGNITION[Season.Summer] * DROUGHT_IGNITION;
    expect(ratio).toBeGreaterThan(expected - 0.1);
    expect(ratio).toBeLessThan(expected + 0.1);
    expect(dryFires).toBeGreaterThan(1.5 * wetFires);
  });

  it('fait tomber la neige au début de l’hiver, et la fait fondre pendant son dernier mois', () => {
    const w = weather();
    const winter = 3 * TICKS_PER_SEASON;
    // Jusqu'à la fin de l'automne, seuls les sommets sont enneigés
    run(w, winter);
    expect(w.snowLine).toBe(SNOW_HEIGHT);
    // Au premier pas de l'hiver, le hasard dit s'il sera rude : la neige descendra jusqu'au rivage
    w.tick(winter);
    const lowest = w.harshWinter ? 0 : WINTER_SNOW_LINE;
    const middle = (SNOW_HEIGHT + lowest) / 2;
    // La neige tombe pendant SNOWFALL_TICKS pas : à mi-chemin, puis au plus bas
    run(w, SNOWFALL_TICKS / 2, winter + 1);
    expect(w.snowLine).toBeCloseTo(middle);
    run(w, SNOWFALL_TICKS / 2, winter + 1 + SNOWFALL_TICKS / 2);
    expect(w.snowLine).toBe(lowest);
    // Elle reste jusqu'au dernier mois de l'hiver, puis fond
    const thaw = winter + TICKS_PER_SEASON - THAW_TICKS;
    run(w, thaw - winter - SNOWFALL_TICKS, winter + SNOWFALL_TICKS + 1);
    expect(w.snowLine).toBe(lowest);
    run(w, THAW_TICKS / 2, thaw + 1);
    expect(w.snowLine).toBeCloseTo(middle);
    // Au printemps, il ne reste que les sommets
    run(w, THAW_TICKS / 2, thaw + 1 + THAW_TICKS / 2);
    expect(w.snowLine).toBe(SNOW_HEIGHT);
    expect(w.harshWinter).toBe(false);
  });

  it('rend un hiver sur cinq environ rude : la neige couvre alors toute l’île', () => {
    const w = weather();
    let harsh = 0;
    for (let year = 0; year < 200; year++) {
      // Le premier pas de l'hiver, puis le moment où toute la neige est tombée
      const winter = year * TICKS_PER_YEAR + 3 * TICKS_PER_SEASON;
      w.tick(winter);
      w.tick(winter + SNOWFALL_TICKS);
      expect(w.snowLine).toBe(w.harshWinter ? 0 : WINTER_SNOW_LINE);
      if (w.harshWinter) harsh++;
    }
    // En moyenne 40 hivers rudes sur 200
    expect(harsh).toBeGreaterThan(25);
    expect(harsh).toBeLessThan(55);
  });

  it('retire les nuages qui ont fini leur vie ou quitté la carte', () => {
    const w = weather();
    for (let t = 0; t < 3 * TICKS_PER_YEAR; t++) {
      w.tick(t);
      for (const cloud of w.clouds) {
        expect(cloud.age).toBeLessThan(cloud.life);
        expect(cloud.x).toBeGreaterThanOrEqual(-2 * MAX_CLOUD_RADIUS);
        expect(cloud.x).toBeLessThanOrEqual(256 + 2 * MAX_CLOUD_RADIUS);
        expect(cloud.y).toBeGreaterThanOrEqual(-2 * MAX_CLOUD_RADIUS);
        expect(cloud.y).toBeLessThanOrEqual(192 + 2 * MAX_CLOUD_RADIUS);
      }
    }
  });

  it('couvre le ciel plus souvent en hiver qu’en été', () => {
    const w = weather();
    // Nombre moyen de nuages pendant chaque saison, sur 5 ans
    const total = [0, 0, 0, 0];
    const ticks = [0, 0, 0, 0];
    for (let t = 0; t < 5 * TICKS_PER_YEAR; t++) {
      w.tick(t);
      total[seasonAt(t)] += w.clouds.length;
      ticks[seasonAt(t)]++;
    }
    const summer = total[Season.Summer] / ticks[Season.Summer];
    const winter = total[Season.Winter] / ticks[Season.Winter];
    expect(winter).toBeGreaterThan(summer * 1.5);
    // Jamais plus que ce que la saison demande, à un nuage près (ceux qui restent de la saison d'avant)
    expect(winter).toBeLessThanOrEqual(w.cloudTarget(Season.Winter));
  });

  it('a plus de nuages sur une carte plus grande', () => {
    // 4 fois plus de tuiles : 31 nuages au printemps au lieu de 8 (1,6 pour 10 000 tuiles)
    const big = new Weather(512, 384, 1);
    expect(big.cloudTarget(Season.Spring)).toBe(31);
  });

  it('donne la même météo à la même graine, et une autre à une autre graine', () => {
    const a = weather(7);
    const b = weather(7);
    const c = weather(8);
    run(a, 2000);
    run(b, 2000);
    run(c, 2000);
    expect(a.clouds).toEqual(b.clouds);
    expect(a.windAngle).toBe(b.windAngle);
    expect(a.clouds).not.toEqual(c.clouds);
  });
});
