import { Random } from './core/random';
import { PointerInput } from './input/pointer-input';
import { Camera, type Point } from './render/camera';
import { drawCloudShadows, drawWeatherClouds } from './render/cloud-renderer';
import { MapRenderer } from './render/map-renderer';
import { drawPeople } from './render/people-renderer';
import { drawVillages } from './render/village-renderer';
import { Effects } from './render/effects';
import { FireRenderer } from './render/fire-renderer';
import { dateAt, type GameDate } from './sim/calendar';
import { SimClock, type SimSpeed } from './sim/sim-clock';
import {
  FERTILITY_RADIUS,
  FIRE_RADIUS,
  LIGHTNING_RADIUS,
  QUAKE_RADIUS,
  RAIN_RADIUS,
  Simulation,
} from './sim/simulation';
import { isRaining, rainRadius } from './sim/weather';
import { HAND, PowerKind, type Tool } from './tool';
import { applyBrush } from './world/brushes';
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

/** Petit résumé du monde, envoyé à l'interface quelques fois par seconde : la date, et… */
export interface WorldSummary extends GameDate {
  /** Nombre d'habitants vivants */
  population: number;
  /** Nombre de villages */
  villages: number;
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
  private fireRenderer!: FireRenderer;
  private simulation!: Simulation;
  private frameId = 0;
  private lastFrameTime = 0;

  /** Outil tenu par le dieu : main, pinceau ou pouvoir */
  private tool: Tool = HAND;
  private readonly effects = new Effects();
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
    this.fireRenderer = new FireRenderer(this.world);
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
      // La date vient de la simulation : c'est elle qui compte les pas
      ...dateAt(this.simulation.ticks),
      population: this.simulation.people.count,
      villages: this.simulation.villages.count,
    };
  }

  /** Recentre la vue sur le monde entier */
  resetView(): void {
    if (this.camera.hasViewport) {
      this.camera.fitWorld();
    }
  }

  /** Choisit l'outil : main, pinceau ou pouvoir */
  setTool(tool: Tool): void {
    this.tool = tool;
    this.input.setLeftButtonPans(tool.type === 'hand');
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

  /** Fait évoluer le monde : outil du dieu, puis simulation, effets et résumé */
  private update(dt: number): void {
    // Vrai seulement à l'image qui suit le début du clic (et pas tant qu'il est maintenu)
    const clicked = this.input.takeClick();

    // Les outils suivent le temps réel : le dieu agit même en pause
    if (this.tool.type === 'brush') {
      this.paint(dt);
    } else if (this.tool.type === 'power') {
      if (this.tool.power === PowerKind.Rain) {
        // La pluie agit en continu, comme un pinceau
        if (this.input.painting) this.pourRain(dt);
      } else if (clicked) {
        this.castPower(this.tool.power);
      }
    }
    this.effects.update(dt);

    const ticks = this.clock.advance(dt);
    for (let i = 0; i < ticks; i++) {
      this.simulateTick();
    }
    // Des forêts ont brûlé, ou un séisme a bouleversé le relief : on redessine seulement la zone touchée
    const changed = this.simulation.takeDirtyRect();
    if (changed) {
      this.mapRenderer.redrawRect(changed);
    }
    // Les éclairs des orages tombés pendant ces pas
    for (const strike of this.simulation.takeStrikes()) {
      this.effects.addLightning(strike.x + 0.5, strike.y + 0.5, true);
    }
    // La pluie tombe sous les nuages de pluie, même en pause (comme les flammes scintillent)
    for (const cloud of this.simulation.weather.clouds) {
      if (isRaining(cloud)) this.effects.skyRain(cloud.x, cloud.y, rainRadius(cloud), dt);
    }
    // Les couleurs de la carte suivent les saisons
    this.mapRenderer.setTime(this.simulation.ticks);
    // Les flammes scintillent à chaque image, même en pause
    this.fireRenderer.update(this.simulation.fire, (x, y) => this.effects.addSmoke(x, y));

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

  /** Lance un pouvoir sur la tuile sous le pointeur */
  private castPower(power: PowerKind): void {
    const tile = this.hoveredTile();
    if (!tile || !this.world.inBounds(tile.x, tile.y)) return;

    switch (power) {
      case PowerKind.Lightning:
        this.simulation.strikeLightning(tile.x, tile.y);
        this.effects.addLightning(tile.x + 0.5, tile.y + 0.5);
        break;
      case PowerKind.Fire:
        this.simulation.igniteFire(tile.x, tile.y);
        break;
      case PowerKind.Quake:
        // Le relief change : la zone sera redessinée avec takeDirtyRect(), juste après
        this.simulation.quake(tile.x, tile.y);
        this.effects.addQuake(tile.x + 0.5, tile.y + 0.5, QUAKE_RADIUS);
        break;
      case PowerKind.Fertility:
        this.simulation.bless(tile.x, tile.y);
        this.effects.addBlessing(tile.x + 0.5, tile.y + 0.5, FERTILITY_RADIUS);
        break;
    }
  }

  /** Fait pleuvoir sous le pointeur pendant `dt` secondes */
  private pourRain(dt: number): void {
    const tile = this.hoveredTile();
    if (!tile || !this.world.inBounds(tile.x, tile.y)) return;

    this.simulation.rain(tile.x, tile.y, dt);
    this.effects.rain(tile.x + 0.5, tile.y + 0.5, RAIN_RADIUS, dt);
  }

  /** Applique le pinceau actif sous le pointeur */
  private paint(dt: number): void {
    if (this.tool.type !== 'brush' || !this.input.painting) return;

    const tile = this.hoveredTile();
    if (!tile) return;

    const changed = applyBrush(
      this.world,
      { kind: this.tool.brush, radius: this.brushRadius, strength: BRUSH_SPEED * dt },
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

    // Position à l'écran du coin haut-gauche du monde, secouée pendant un séisme
    const origin = camera.worldToScreen(0, 0);
    const shake = this.effects.shakeOffset();
    const ox = Math.round(origin.x) + shake.x;
    const oy = Math.round(origin.y) + shake.y;
    this.mapRenderer.draw(ctx, ox, oy, camera.zoom);
    this.fireRenderer.draw(ctx, ox, oy, camera.zoom);
    // Les ombres des nuages sur le sol, puis les nuages dans le ciel, au-dessus des mortels
    drawCloudShadows(ctx, this.simulation.weather, ox, oy, camera.zoom);
    drawVillages(ctx, this.simulation.villages, ox, oy, camera.zoom);
    drawPeople(ctx, this.simulation.people, ox, oy, camera.zoom);
    drawWeatherClouds(ctx, this.simulation.weather, ox, oy, camera.zoom);
    this.effects.draw(ctx, ox, oy, camera.zoom);

    this.drawToolPreview();
  }

  /**
   * Cercle qui montre la zone que l'outil va toucher :
   * plein et blanc pour un pinceau, en pointillés bleus pour un pouvoir
   */
  private drawToolPreview(): void {
    if (this.tool.type === 'hand') return;
    const tile = this.hoveredTile();
    if (!tile) return;

    const { ctx, camera } = this;
    const center = camera.worldToScreen(tile.x + 0.5, tile.y + 0.5);
    const isPower = this.tool.type === 'power';
    const tiles =
      this.tool.type === 'power' ? powerRadius(this.tool.power) : this.brushRadius + 0.5;
    // Au moins 4 pixels, pour rester visible quand on dézoome
    const radius = Math.max(4, tiles * camera.zoom);

    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.setLineDash(isPower ? [4, 3] : []);

    // Contour sombre puis clair : visible sur l'eau comme sur la neige
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isPower ? 'rgba(170, 200, 255, 0.95)' : 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Rayon d'action d'un pouvoir, en tuiles, pour le cercle d'aperçu */
function powerRadius(power: PowerKind): number {
  switch (power) {
    case PowerKind.Lightning:
      return LIGHTNING_RADIUS;
    case PowerKind.Fire:
      // + 0.5 : le cercle entoure les tuiles touchées au lieu de passer par leur centre
      return FIRE_RADIUS + 0.5;
    case PowerKind.Rain:
      return RAIN_RADIUS + 0.5;
    case PowerKind.Quake:
      return QUAKE_RADIUS + 0.5;
    case PowerKind.Fertility:
      return FERTILITY_RADIUS + 0.5;
  }
}
