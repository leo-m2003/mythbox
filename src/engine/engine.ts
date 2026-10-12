import { Random } from './core/random';
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
  private world!: World;
  private mapRenderer!: MapRenderer;
  private frameId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Ce navigateur ne permet pas de dessiner sur le canvas");
    }
    this.ctx = ctx;
    this.newWorld();
  }

  get seed(): number {
    return this.world.seed;
  }

  /** Génère un nouveau monde, avec une graine aléatoire si aucune n'est donnée */
  newWorld(seed: number = Random.newSeed()): void {
    this.world = generateWorld({ width: WORLD_WIDTH, height: WORLD_HEIGHT, seed });
    this.mapRenderer = new MapRenderer(this.world);
  }

  /** À appeler quand la taille du canvas à l'écran change */
  resize(cssWidth: number, cssHeight: number, pixelRatio = 1): void {
    this.canvas.width = Math.round(cssWidth * pixelRatio);
    this.canvas.height = Math.round(cssHeight * pixelRatio);
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

  private render(): void {
    const { ctx, canvas, world } = this;

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Temporaire : la carte entière, centrée. Remplacé par la caméra à l'étape 5.
    const scale = Math.min(canvas.width / world.width, canvas.height / world.height);
    const offsetX = (canvas.width - world.width * scale) / 2;
    const offsetY = (canvas.height - world.height * scale) / 2;

    this.mapRenderer.draw(ctx, offsetX, offsetY, scale);
  }
}