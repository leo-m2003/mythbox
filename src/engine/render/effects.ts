import { Random } from '../core/random';

/** Durée d'un éclair à l'écran, en secondes */
const LIGHTNING_DURATION = 0.4;
/** Durée du flash blanc sur tout l'écran, en secondes */
const FLASH_DURATION = 0.08;
/** Hauteur d'où part l'éclair, en tuiles au-dessus de l'impact */
const BOLT_HEIGHT = 24;
const BOLT_SEGMENTS = 10;

/** Nombre maximal de volutes de fumée à l'écran (les suivantes sont ignorées) */
const MAX_SMOKE = 600;
/** Durée de vie d'une volute de fumée, en secondes */
const SMOKE_DURATION = 2.5;
/** Vitesse de montée de la fumée, en tuiles par seconde */
const SMOKE_RISE = 1.2;

/** Nombre maximal de gouttes de pluie à l'écran */
const MAX_DROPS = 800;
/** Gouttes qui tombent chaque seconde, par tuile de la zone de pluie */
const DROPS_PER_TILE = 6;
/** Hauteur d'où tombe une goutte, en tuiles au-dessus de son point de chute */
const DROP_HEIGHT = 4;
/** Vitesse de chute, en tuiles par seconde */
const DROP_SPEED = 14;
/** Longueur du trait d'une goutte, en tuiles */
const DROP_LENGTH = 0.7;
/** Durée de l'éclaboussure au sol, en secondes */
const SPLASH_DURATION = 0.25;
/** Vitesse à laquelle le nuage et son ombre apparaissent et disparaissent (1 = en une seconde) */
const CLOUD_FADE = 3;

/**
 * Forme du nuage : des disques qui se chevauchent, en x, y et rayon,
 * exprimés en fraction du rayon de la pluie (le nuage grandit avec elle).
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

  // La fumée : beaucoup de petites particules, rangées en tableaux typés (comme People)
  private readonly smokeX = new Float32Array(MAX_SMOKE);
  private readonly smokeY = new Float32Array(MAX_SMOKE);
  /** Dérive horizontale, en tuiles par seconde */
  private readonly smokeDrift = new Float32Array(MAX_SMOKE);
  private readonly smokeAge = new Float32Array(MAX_SMOKE);
  private smokeCount = 0;

  // La pluie : gouttes en tableaux typés, comme la fumée
  private readonly dropX = new Float32Array(MAX_DROPS);
  /** Point de chute de la goutte (le sol), en tuiles */
  private readonly dropY = new Float32Array(MAX_DROPS);
  /** Hauteur restante avant le sol, en tuiles (0 = la goutte éclabousse) */
  private readonly dropHeight = new Float32Array(MAX_DROPS);
  /** Temps écoulé depuis l'arrivée au sol, en secondes */
  private readonly dropSplash = new Float32Array(MAX_DROPS);
  private dropCount = 0;
  /** Gouttes en attente : une fraction de goutte reste pour l'image suivante */
  private pendingDrops = 0;

  /** L'ombre du nuage : centre et rayon en tuiles, et opacité de 0 à 1 */
  private cloudX = 0;
  private cloudY = 0;
  private cloudRadius = 0;
  private cloud = 0;
  /** Vrai si rain() a été appelée depuis le dernier update() */
  private raining = false;
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

  /** Une volute de fumée qui monte depuis le point (x, y), en tuiles */
  addSmoke(x: number, y: number): void {
    if (this.smokeCount >= MAX_SMOKE) return;
    const k = this.smokeCount++;
    this.smokeX[k] = x + this.random.range(-0.3, 0.3);
    this.smokeY[k] = y;
    this.smokeDrift[k] = this.random.range(0.1, 0.6);
    this.smokeAge[k] = 0;
  }

  /**
   * Il pleut pendant `dt` secondes sur le disque de centre (x, y) et de rayon `radius`, en tuiles.
   * À appeler à chaque image tant qu'il pleut.
   */
  rain(x: number, y: number, radius: number, dt: number): void {
    this.raining = true;
    this.cloudX = x;
    this.cloudY = y;
    this.cloudRadius = radius;

    this.pendingDrops += Math.PI * radius * radius * DROPS_PER_TILE * dt;
    while (this.pendingDrops >= 1 && this.dropCount < MAX_DROPS) {
      this.pendingDrops--;
      // Un point au hasard dans le disque (la racine carrée répartit les gouttes uniformément)
      const angle = this.random.range(0, Math.PI * 2);
      const distance = radius * Math.sqrt(this.random.next());
      const k = this.dropCount++;
      this.dropX[k] = x + Math.cos(angle) * distance;
      this.dropY[k] = y + Math.sin(angle) * distance;
      this.dropHeight[k] = this.random.range(0.5, 1) * DROP_HEIGHT;
      this.dropSplash[k] = 0;
    }
    // Trop de gouttes à l'écran : on oublie celles qui ne trouvent pas de place
    this.pendingDrops %= 1;
  }

  update(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.age += dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.age < LIGHTNING_DURATION);

    // À l'envers : une volute trop vieille est remplacée par la dernière (comme People)
    for (let k = this.smokeCount - 1; k >= 0; k--) {
      this.smokeAge[k] += dt;
      if (this.smokeAge[k] >= SMOKE_DURATION) {
        const last = --this.smokeCount;
        this.smokeX[k] = this.smokeX[last];
        this.smokeY[k] = this.smokeY[last];
        this.smokeDrift[k] = this.smokeDrift[last];
        this.smokeAge[k] = this.smokeAge[last];
        continue;
      }
      // Elle monte et le vent la pousse un peu vers la droite
      this.smokeY[k] -= SMOKE_RISE * dt;
      this.smokeX[k] += this.smokeDrift[k] * dt;
    }

    this.updateRain(dt);
  }

  private updateRain(dt: number): void {
    // L'ombre du nuage apparaît tant qu'il pleut, puis s'efface doucement
    this.cloud = this.raining
      ? Math.min(1, this.cloud + CLOUD_FADE * dt)
      : Math.max(0, this.cloud - CLOUD_FADE * dt);
    this.raining = false;

    for (let k = this.dropCount - 1; k >= 0; k--) {
      if (this.dropHeight[k] > 0) {
        this.dropHeight[k] = Math.max(0, this.dropHeight[k] - DROP_SPEED * dt);
        continue;
      }
      this.dropSplash[k] += dt;
      if (this.dropSplash[k] >= SPLASH_DURATION) {
        const last = --this.dropCount;
        this.dropX[k] = this.dropX[last];
        this.dropY[k] = this.dropY[last];
        this.dropHeight[k] = this.dropHeight[last];
        this.dropSplash[k] = this.dropSplash[last];
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, zoom: number): void {
    this.drawSmoke(ctx, originX, originY, zoom);
    this.drawRain(ctx, originX, originY, zoom);
    this.drawCloud(ctx, originX, originY, zoom);

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

  /** La fumée : des disques gris qui grossissent et s'effacent en montant */
  private drawSmoke(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    zoom: number,
  ): void {
    for (let k = 0; k < this.smokeCount; k++) {
      // De 0 (vient de naître) à 1 (va disparaître)
      const t = this.smokeAge[k] / SMOKE_DURATION;
      const radius = Math.max(1.5, (0.4 + t * 0.8) * zoom);
      ctx.fillStyle = `rgba(70, 66, 62, ${0.45 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(originX + this.smokeX[k] * zoom, originY + this.smokeY[k] * zoom, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** L'ombre du nuage, puis les gouttes (traits obliques) et leurs éclaboussures (petits cercles) */
  private drawRain(ctx: CanvasRenderingContext2D, originX: number, originY: number, zoom: number): void {
    if (this.cloud > 0) {
      const cx = originX + this.cloudX * zoom;
      const cy = originY + this.cloudY * zoom;
      const r = (this.cloudRadius + 1) * zoom;
      const shadow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      shadow.addColorStop(0, `rgba(20, 30, 60, ${0.3 * this.cloud})`);
      shadow.addColorStop(1, 'rgba(20, 30, 60, 0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    if (this.dropCount === 0) return;
    ctx.lineWidth = Math.max(1, zoom * 0.1);
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.75)';
    // Toutes les gouttes en un seul tracé : bien plus rapide qu'un stroke() par goutte
    ctx.beginPath();
    for (let k = 0; k < this.dropCount; k++) {
      const h = this.dropHeight[k];
      if (h === 0) continue;
      // Un peu de vent : la goutte arrive de la gauche
      const x = originX + (this.dropX[k] - h * 0.2) * zoom;
      const y = originY + (this.dropY[k] - h) * zoom;
      ctx.moveTo(x, y);
      ctx.lineTo(x + DROP_LENGTH * 0.2 * zoom, y + DROP_LENGTH * zoom);
    }
    ctx.stroke();

    ctx.lineWidth = 1;
    for (let k = 0; k < this.dropCount; k++) {
      if (this.dropHeight[k] > 0) continue;
      // De 0 (vient de toucher le sol) à 1 (va disparaître)
      const t = this.dropSplash[k] / SPLASH_DURATION;
      ctx.strokeStyle = `rgba(200, 220, 255, ${0.6 * (1 - t)})`;
      ctx.beginPath();
      ctx.ellipse(
        originX + this.dropX[k] * zoom,
        originY + this.dropY[k] * zoom,
        Math.max(1, (0.1 + 0.25 * t) * zoom),
        Math.max(0.5, (0.05 + 0.12 * t) * zoom),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }

  /**
   * Le petit nuage d'où tombe la pluie, au-dessus de la zone arrosée.
   * Les gouttes partent jusqu'à DROP_HEIGHT tuiles plus haut et un peu à gauche (le vent) :
   * le nuage est placé là.
   */
  private drawCloud(ctx: CanvasRenderingContext2D, originX: number, originY: number, zoom: number): void {
    if (this.cloud === 0) return;
    const size = this.cloudRadius * zoom;
    const cx = originX + (this.cloudX - DROP_HEIGHT * 0.2) * zoom;
    const cy = originY + (this.cloudY - DROP_HEIGHT - 0.5) * zoom;

    // Deux passes : le dessous gris, un peu décalé vers le bas, puis le dessus clair
    for (const [shift, color] of [
      [0.12, `rgba(120, 130, 150, ${0.9 * this.cloud})`],
      [0, `rgba(235, 240, 248, ${0.95 * this.cloud})`],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [px, py, pr] of CLOUD_PUFFS) {
        const x = cx + px * size;
        const y = cy + (py + shift) * size;
        // moveTo évite un trait entre deux disques du même tracé
        ctx.moveTo(x + pr * size, y);
        ctx.arc(x, y, pr * size, 0, Math.PI * 2);
      }
      ctx.fill();
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