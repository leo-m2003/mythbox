import { Random } from './core/random';
import { PointerInput } from './input/pointer-input';
import { Camera, type Point } from './render/camera';
import { MapRenderer } from './render/map-renderer';
import { drawPeople } from './render/people-renderer';
import { SimClock, TICKS_PER_DAY, type SimSpeed } from './sim/sim-clock';
import { Simulation } from './sim/simulation';
import { applyBrush, BrushKind } from './world/brushes';
import { generateWorld } from './world/generator';
import { World } from './world/world';

const WORLD_WIDTH = 256;
const WORLD_HEIGHT = 192;

/** Couleur de fond : l'océan profond, assombri */
const BACKGROUND = '#12274a';

export const MIN_BRUSH_RADIUS = 1;
export const MAX_BRUSH_RADIUS = 12;

/** Vitesse des pinceaux : variation d'altitude par seconde au centre du pinceau */
const BRUSH_SPEED = 0.25;

/** Durée maximale d'une image, en secondes (évite un énorme coup de pinceau après une pause) */
const MAX_FRAME_TIME = 0.05;

/** Intervalle entre deux résumés envoyés à l'interface, en secondes */
const SUMMARY_INTERVAL = 0.25;

/** Petit résumé du monde, envoyé à l'interface quelques fois par seconde */
export interface WorldSummary {
  /** Jour en cours, à partir de 1 */
  day: number;
  /** Nombre d'habitants vivants */
  population: number;
}

/**
 * Point d'entrée unique du moteur.
 * Angular ne parle qu'à cette classe, jamais directement au monde ou au rendu.
 */
export class Engine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera = new Camera(WORLD_WIDTH, WORLD_HEIGHT);
  private readonly input: PointerInput;
  private world!: World;
  private mapRenderer!: MapRenderer;
  private simulation!: Simulation;
  private frameId = 0;
  private lastFrameTime = 0;

  /** Pinceau actif, ou null pour l'outil « main » */
  private activeBrush: BrushKind | null = null;
  private brushRadius = 4;

  private readonly clock = new SimClock();
  private summaryTimer = 0;

  /** Appelé quelques fois par seconde avec le résumé du monde */
  onSummary?: (summary: WorldSummary) => void;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Ce navigateur ne permet pas de dessiner sur le canvas');
    }
    this.ctx = ctx;
    this.input = new PointerInput(canvas, this.camera);
    this.newWorld();
  }

  get seed(): number {
    return this.world.seed;
  }

  /** Génère un nouveau monde, avec une graine aléatoire si aucune n'est donnée */
  newWorld(seed: number = Random.newSeed()): void {
    this.world = generateWorld({ width: WORLD_WIDTH, height: WORLD_HEIGHT, seed });
    this.mapRenderer = new MapRenderer(this.world);
    this.simulation = new Simulation(this.world, seed);
    this.simulation.spawnInitialGroup();
    this.clock.reset();
    this.resetView();
    this.emitSummary();
  }

  get speed(): SimSpeed {
    return this.clock.speed;
  }

  /** Change la vitesse de la simulation (0 = pause) */
  setSpeed(speed: SimSpeed): void {
    this.clock.setSpeed(speed);
  }

  /** Résumé du monde à l'instant présent */
  summary(): WorldSummary {
    return {
      day: Math.floor(this.clock.tick / TICKS_PER_DAY) + 1,
      population: this.simulation.people.count,
    };
  }

  /** Recentre la vue sur le monde entier */
  resetView(): void {
    if (this.camera.hasViewport) {
      this.camera.fitWorld();
    }
  }

  /** Choisit le pinceau actif, ou null pour l'outil « main » */
  setBrush(kind: BrushKind | null): void {
    this.activeBrush = kind;
    this.input.setLeftButtonPans(kind === null);
  }

  /** Change le rayon du pinceau, en tuiles */
  setBrushRadius(radius: number): void {
    this.brushRadius = Math.min(MAX_BRUSH_RADIUS, Math.max(MIN_BRUSH_RADIUS, Math.round(radius)));
  }

  /** À appeler quand la taille du canvas à l'écran change */
  resize(cssWidth: number, cssHeight: number, pixelRatio = 1): void {
    const isFirstResize = !this.camera.hasViewport;
    this.canvas.width = Math.round(cssWidth * pixelRatio);
    this.canvas.height = Math.round(cssHeight * pixelRatio);
    this.camera.setViewport(this.canvas.width, this.canvas.height);
    if (isFirstResize) {
      this.camera.fitWorld();
    }
  }

  start(): void {
    if (this.frameId) return;
    const loop = (time: number) => {
      // Temps écoulé depuis l'image précédente, en secondes
      const dt = this.lastFrameTime
        ? Math.min(MAX_FRAME_TIME, (time - this.lastFrameTime) / 1000)
        : 0;
      this.lastFrameTime = time;

      this.update(dt);
      this.render();
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.lastFrameTime = 0;
  }

  /** Arrête le moteur et retire tous ses écouteurs d'événements */
  destroy(): void {
    this.stop();
    this.input.dispose();
  }

  /** Fait évoluer le monde : pinceau, puis simulation, puis résumé */
  private update(dt: number): void {
    // Le pinceau suit le temps réel : on peut façonner le monde même en pause
    this.paint(dt);

    const ticks = this.clock.advance(dt);
    for (let i = 0; i < ticks; i++) {
      this.simulateTick();
    }

    this.summaryTimer += dt;
    if (this.summaryTimer >= SUMMARY_INTERVAL) {
      this.summaryTimer = 0;
      this.emitSummary();
    }
  }

  /** Un pas de simulation (1/10 de seconde à x1) */
  private simulateTick(): void {
    this.simulation.tick();
  }

  private emitSummary(): void {
    this.onSummary?.(this.summary());
  }

  /** Applique le pinceau actif sous le pointeur */
  private paint(dt: number): void {
    if (this.activeBrush === null || !this.input.painting) return;

    const tile = this.hoveredTile();
    if (!tile) return;

    const changed = applyBrush(
      this.world,
      { kind: this.activeBrush, radius: this.brushRadius, strength: BRUSH_SPEED * dt },
      tile.x,
      tile.y,
    );
    if (changed) {
      this.mapRenderer.redrawRect(changed);
    }
  }

  /** Tuile située sous le pointeur, ou null */
  private hoveredTile(): Point | null {
    const hover = this.input.hover;
    if (!hover) return null;
    const world = this.camera.screenToWorld(hover.x, hover.y);
    return { x: Math.floor(world.x), y: Math.floor(world.y) };
  }

  private render(): void {
    const { ctx, canvas, camera } = this;

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Position à l'écran du coin haut-gauche du monde
    const origin = camera.worldToScreen(0, 0);
    this.mapRenderer.draw(ctx, Math.round(origin.x), Math.round(origin.y), camera.zoom);
    drawPeople(ctx, this.simulation.people, Math.round(origin.x), Math.round(origin.y), camera.zoom);

    this.drawBrushPreview();
  }

  /** Cercle qui montre la zone que le pinceau va toucher */
  private drawBrushPreview(): void {
    if (this.activeBrush === null) return;
    const tile = this.hoveredTile();
    if (!tile) return;

    const { ctx, camera } = this;
    const center = camera.worldToScreen(tile.x + 0.5, tile.y + 0.5);
    const radius = (this.brushRadius + 0.5) * camera.zoom;

    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);

    // Contour sombre puis clair : visible sur l'eau comme sur la neige
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }
}