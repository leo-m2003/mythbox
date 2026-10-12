import { Random } from './core/random';
import { CameraControls } from './input/camera-controls';
import { Camera } from './render/camera';
import { MapRenderer } from './render/map-renderer';
import { generateWorld } from './world/generator';
import { World } from './world/world';

const WORLD_WIDTH = 256;
const WORLD_HEIGHT = 192;

/** Couleur de fond : l'océan profond, assombri */
const BACKGROUND = '#12274a';

/**
 * Point d'entrée unique du moteur.
 * Angular ne parle qu'à cette classe, jamais directement au monde ou au rendu.
 */
export class Engine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera = new Camera(WORLD_WIDTH, WORLD_HEIGHT);
  private readonly controls: CameraControls;
  private world!: World;
  private mapRenderer!: MapRenderer;
  private frameId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Ce navigateur ne permet pas de dessiner sur le canvas');
    }
    this.ctx = ctx;
    this.controls = new CameraControls(canvas, this.camera);
    this.newWorld();
  }

  get seed(): number {
    return this.world.seed;
  }

  /** Génère un nouveau monde, avec une graine aléatoire si aucune n'est donnée */
  newWorld(seed: number = Random.newSeed()): void {
    this.world = generateWorld({ width: WORLD_WIDTH, height: WORLD_HEIGHT, seed });
    this.mapRenderer = new MapRenderer(this.world);
    this.resetView();
  }

  /** Recentre la vue sur le monde entier */
  resetView(): void {
    if (this.camera.hasViewport) {
      this.camera.fitWorld();
    }
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
    const loop = () => {
      this.render();
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  /** Arrête le moteur et retire tous ses écouteurs d'événements */
  destroy(): void {
    this.stop();
    this.controls.dispose();
  }

  private render(): void {
    const { ctx, canvas, camera } = this;

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Position à l'écran du coin haut-gauche du monde
    const origin = camera.worldToScreen(0, 0);
    this.mapRenderer.draw(ctx, Math.round(origin.x), Math.round(origin.y), camera.zoom);
  }
}