import { describe, it, expect } from 'vitest';
import { Season, seasonAt } from './calendar';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from './sim-clock';
import {
  cloudOpacity,
  isRaining,
  MAX_CLOUD_RADIUS,
  MAX_WIND_SPEED,
  MAX_WIND_TURN,
  MIN_WIND_SPEED,
  rainRadius,
  SEASON_IGNITION,
  Weather,
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
