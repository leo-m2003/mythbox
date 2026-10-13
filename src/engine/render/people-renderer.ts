import type { People } from '../sim/people';

/** Couleur des mortels : un blanc crème, visible sur l'herbe comme sur le sable */
const PERSON_COLOR = '#fff4d6';
const OUTLINE_COLOR = 'rgba(0, 0, 0, 0.6)';

/**
 * Dessine chaque habitant comme un petit carré bordé de noir.
 * (originX, originY) est la position à l'écran du coin haut-gauche du monde,
 * zoom le nombre de pixels par tuile.
 */
export function drawPeople(
  ctx: CanvasRenderingContext2D,
  people: People,
  originX: number,
  originY: number,
  zoom: number,
): void {
  // Au moins 2 pixels pour rester visible quand on dézoome
  const size = Math.max(2, Math.round(zoom * 0.5));
  const half = size / 2;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Deux passes (contour puis remplissage) : on ne change de couleur que deux fois
  ctx.fillStyle = OUTLINE_COLOR;
  for (let i = 0; i < people.count; i++) {
    const sx = Math.round(originX + people.x[i] * zoom - half);
    const sy = Math.round(originY + people.y[i] * zoom - half);
    if (sx < -size || sy < -size || sx > width || sy > height) continue;
    ctx.fillRect(sx - 1, sy - 1, size + 2, size + 2);
  }

  ctx.fillStyle = PERSON_COLOR;
  for (let i = 0; i < people.count; i++) {
    const sx = Math.round(originX + people.x[i] * zoom - half);
    const sy = Math.round(originY + people.y[i] * zoom - half);
    if (sx < -size || sy < -size || sx > width || sy > height) continue;
    ctx.fillRect(sx, sy, size, size);
  }
}