import { cloudOpacity, type Weather } from '../sim/weather';

/**
 * Forme d'un nuage : des disques qui se chevauchent, en x, y et rayon,
 * exprimés en fraction de la taille du nuage.
 */
const CLOUD_PUFFS = [
  [-0.55, 0.1, 0.35],
  [-0.25, -0.12, 0.45],
  [0.15, -0.2, 0.5],
  [0.5, -0.02, 0.38],
  [0.75, 0.15, 0.25],
  [0, 0.15, 0.4],
  [-0.8, 0.2, 0.22],
] as const;

/** Altitude des nuages de la météo, en tuiles : ils flottent au nord-ouest de leur ombre */
export const CLOUD_HEIGHT = 6;

/** Couleurs d'un nuage, en RGB : le dessous (dans l'ombre), puis le dessus */
export type CloudColors = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
];

/** Un nuage de beau temps : blanc */
export const FAIR_CLOUD: CloudColors = [
  [120, 130, 150],
  [235, 240, 248],
];
/** Un nuage de pluie : gris */
export const RAIN_CLOUD: CloudColors = [
  [85, 95, 115],
  [170, 178, 192],
];
/** Un orage : gris sombre */
export const STORM_CLOUD: CloudColors = [
  [45, 48, 62],
  [100, 104, 120],
];

/** Zoom (pixels par tuile) à partir duquel les nuages s'estompent, pour ne pas cacher les mortels */
const CLEAR_FROM_ZOOM = 8;
/** Zoom auquel ils sont le plus transparents */
const CLEAR_AT_ZOOM = 32;
/** Opacité des nuages quand on zoome au plus près */
const MIN_ZOOMED_OPACITY = 0.2;

/** Un nuage, comme on le voit sur la carte : où le dessiner, à quelle taille, et sa forme */
export interface CloudShape {
  /** Centre, en pixels à l'écran */
  x: number;
  y: number;
  /** Taille, en pixels */
  size: number;
  /** Étirement horizontal (1 = sans étirement) */
  stretch: number;
  /** Forme retournée de gauche à droite */
  mirrored: boolean;
}

/**
 * Ajoute les disques d'un nuage au tracé en cours, décalés de `shift` (en fraction de sa taille) vers le bas.
 * Tous les disques sont dans le même tracé : remplis d'un coup, ils ne s'assombrissent pas là où ils se chevauchent.
 */
function traceCloud(ctx: CanvasRenderingContext2D, shape: CloudShape, shift: number): void {
  const { size } = shape;
  const sideways = (shape.mirrored ? -1 : 1) * shape.stretch;
  for (const [px, py, pr] of CLOUD_PUFFS) {
    const x = shape.x + px * sideways * size;
    const y = shape.y + (py + shift) * size;
    // moveTo évite un trait entre deux disques du même tracé
    ctx.moveTo(x + pr * size, y);
    ctx.arc(x, y, pr * size, 0, Math.PI * 2);
  }
}

/** Dessine un nuage en deux passes : le dessous gris, un peu décalé vers le bas, puis le dessus clair */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  shape: CloudShape,
  opacity: number,
  colors: CloudColors = FAIR_CLOUD,
): void {
  const [under, top] = colors;
  for (const [shift, [r, g, b], alpha] of [
    [0.12, under, 0.9],
    [0, top, 0.95],
  ] as const) {
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * opacity})`;
    ctx.beginPath();
    traceCloud(ctx, shape, shift);
    ctx.fill();
  }
}

/** Les ombres des nuages de la météo, sur le sol : à dessiner sous les villages et les mortels */
export function drawCloudShadows(
  ctx: CanvasRenderingContext2D,
  weather: Weather,
  originX: number,
  originY: number,
  zoom: number,
): void {
  for (const cloud of weather.clouds) {
    const shape = {
      x: originX + cloud.x * zoom,
      y: originY + cloud.y * zoom,
      size: cloud.radius * zoom,
      stretch: cloud.stretch,
      mirrored: cloud.mirrored,
    };
    ctx.fillStyle = `rgba(10, 20, 45, ${0.18 * cloudOpacity(cloud)})`;
    ctx.beginPath();
    traceCloud(ctx, shape, 0);
    ctx.fill();
  }
}

/** Les nuages de la météo, dans le ciel : à dessiner par-dessus la carte, les villages et les mortels */
export function drawWeatherClouds(
  ctx: CanvasRenderingContext2D,
  weather: Weather,
  originX: number,
  originY: number,
  zoom: number,
): void {
  // Plus on zoome, plus ils sont transparents : on voit les mortels à travers
  const clearing = (zoom - CLEAR_FROM_ZOOM) / (CLEAR_AT_ZOOM - CLEAR_FROM_ZOOM);
  const zoomOpacity = Math.max(
    MIN_ZOOMED_OPACITY,
    Math.min(1, 1 - clearing * (1 - MIN_ZOOMED_OPACITY)),
  );

  for (const cloud of weather.clouds) {
    const shape = {
      x: originX + (cloud.x - CLOUD_HEIGHT * 0.4) * zoom,
      y: originY + (cloud.y - CLOUD_HEIGHT) * zoom,
      size: cloud.radius * zoom,
      stretch: cloud.stretch,
      mirrored: cloud.mirrored,
    };
    const colors = cloud.storm ? STORM_CLOUD : cloud.rain ? RAIN_CLOUD : FAIR_CLOUD;
    drawCloud(ctx, shape, 0.8 * cloudOpacity(cloud) * zoomOpacity, colors);
  }
}
