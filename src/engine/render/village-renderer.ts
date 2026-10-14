import { MAX_VILLAGES, type Villages } from '../sim/villages';

const WALL_COLOR = '#8a5a34';
const ROOF_COLOR = '#c9a24a';
const OUTLINE_COLOR = 'rgba(0, 0, 0, 0.7)';

/**
 * Dessine chaque village comme une petite maison (un mur carré et un toit triangulaire),
 * centrée sur sa tuile. Les villages sont dessinés avant les habitants, qui passent devant.
 */
export function drawVillages(
  ctx: CanvasRenderingContext2D,
  villages: Villages,
  originX: number,
  originY: number,
  zoom: number,
): void {
  // Au moins 6 pixels de large pour rester reconnaissable quand on dézoome
  const size = Math.max(6, Math.round(zoom * 1.6));
  const half = size / 2;

  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE_COLOR;

  for (let v = 0; v < MAX_VILLAGES; v++) {
    if (!villages.active[v]) continue;

    // Centre de la tuile du village, à l'écran
    const cx = Math.round(originX + (villages.x[v] + 0.5) * zoom);
    const cy = Math.round(originY + (villages.y[v] + 0.5) * zoom);

    // Le mur : la moitié basse
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(cx - half, cy, size, half);
    ctx.strokeRect(cx - half, cy, size, half);

    // Le toit : un triangle au-dessus du mur
    ctx.beginPath();
    ctx.moveTo(cx - half - 1, cy);
    ctx.lineTo(cx, cy - half);
    ctx.lineTo(cx + half + 1, cy);
    ctx.closePath();
    ctx.fillStyle = ROOF_COLOR;
    ctx.fill();
    ctx.stroke();
  }
}