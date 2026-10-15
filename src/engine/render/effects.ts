import { Random } from '../core/random';

/** Durée d'un éclair à l'écran, en secondes */
const LIGHTNING_DURATION = 0.4;
/** Durée du flash blanc sur tout l'écran, en secondes */
const FLASH_DURATION = 0.08;
/** Hauteur d'où part l'éclair, en tuiles au-dessus de l'impact */
const BOLT_HEIGHT = 24;
const BOLT_SEGMENTS = 10;

interface Bolt {
  /** Points de la ligne brisée, en tuiles : x0, y0, x1, y1… */
  readonly points: Float32Array;
  readonly impactX: number;
  readonly impactY: number;
  /** Temps écoulé depuis la frappe, en secondes */
  age: number;
}

/**
 * Effets visuels : purement décoratifs, ils ne changent rien au monde.
 * Ils vivent au rythme de l'écran (temps réel), donc continuent même en pause.
 */
export class Effects {
  private bolts: Bolt[] = [];
  // Le hasard des effets n'a pas besoin d'être reproductible : graine quelconque
  private readonly random = new Random(Random.newSeed());

  /** Un éclair qui tombe du ciel sur le point (x, y), en tuiles */
  addLightning(x: number, y: number): void {
    const points = new Float32Array((BOLT_SEGMENTS + 1) * 2);
    for (let s = 0; s <= BOLT_SEGMENTS; s++) {
      const t = s / BOLT_SEGMENTS;
      // Zigzag de plus en plus serré à l'approche du sol, qui finit pile sur l'impact
      const jitter = s === BOLT_SEGMENTS ? 0 : this.random.range(-1.5, 1.5) * (1 - t * 0.6);
      points[s * 2] = x + jitter;
      points[s * 2 + 1] = y - BOLT_HEIGHT * (1 - t);
    }
    this.bolts.push({ points, impactX: x, impactY: y, age: 0 });
  }

  update(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.age += dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.age < LIGHTNING_DURATION);
  }

  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, zoom: number): void {
    for (const bolt of this.bolts) {
      // 1 au moment de la frappe, puis s'efface jusqu'à 0
      const alpha = 1 - bolt.age / LIGHTNING_DURATION;

      // Le flash de tout l'écran, très bref
      if (bolt.age < FLASH_DURATION) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * (1 - bolt.age / FLASH_DURATION)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }

      // Une lueur au point d'impact
      const ix = originX + bolt.impactX * zoom;
      const iy = originY + bolt.impactY * zoom;
      const glow = ctx.createRadialGradient(ix, iy, 0, ix, iy, 3 * zoom);
      glow.addColorStop(0, `rgba(255, 250, 220, ${0.8 * alpha})`);
      glow.addColorStop(1, 'rgba(255, 250, 220, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(ix - 3 * zoom, iy - 3 * zoom, 6 * zoom, 6 * zoom);

      // L'éclair : un halo bleuté large, puis un cœur blanc fin
      this.traceBolt(ctx, bolt, originX, originY, zoom);
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, zoom * 0.7);
      ctx.strokeStyle = `rgba(160, 190, 255, ${0.5 * alpha})`;
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, zoom * 0.2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.stroke();
    }
  }

  private traceBolt(
    ctx: CanvasRenderingContext2D,
    bolt: Bolt,
    originX: number,
    originY: number,
    zoom: number,
  ): void {
    const p = bolt.points;
    ctx.beginPath();
    ctx.moveTo(originX + p[0] * zoom, originY + p[1] * zoom);
    for (let k = 2; k < p.length; k += 2) {
      ctx.lineTo(originX + p[k] * zoom, originY + p[k + 1] * zoom);
    }
  }
}