import { Random } from '../core/random';
import { SCORCH_TICKS, type Fire } from '../sim/fire';
import { World } from '../world/world';

/** Chance, à chaque image, qu'une tuile en feu lâche une volute de fumée */
const SMOKE_CHANCE = 0.03;

/**
 * Dessine les incendies par-dessus la carte : flammes et terre brûlée.
 * Même principe que MapRenderer : un petit canvas caché (1 pixel = 1 tuile),
 * recopié agrandi. Les tuiles sans feu restent transparentes.
 */
export class FireRenderer {
  private readonly buffer: OffscreenCanvas;
  private readonly bufferCtx: OffscreenCanvasRenderingContext2D;
  private readonly image: ImageData;
  // Le scintillement des flammes est décoratif : pas besoin d'être reproductible
  private readonly random = new Random(Random.newSeed());
  /** Vrai si le calque contient quelque chose à dessiner */
  private visible = false;

  constructor(private readonly world: World) {
    this.buffer = new OffscreenCanvas(world.width, world.height);
    const ctx = this.buffer.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible de créer le contexte 2D des incendies');
    }
    this.bufferCtx = ctx;
    this.image = ctx.createImageData(world.width, world.height);
  }

  /**
   * Recalcule le calque. À appeler à chaque image tant qu'il y a du feu (les flammes scintillent).
   * `onSmoke(x, y)` reçoit les tuiles qui fument, pour les particules.
   */
  update(fire: Fire, onSmoke: (x: number, y: number) => void): void {
    if (fire.count === 0 && fire.scorchedCount === 0) {
      if (this.visible) {
        // Le dernier feu vient de s'éteindre et la terre a repoussé : on efface le calque
        this.image.data.fill(0);
        this.bufferCtx.putImageData(this.image, 0, 0);
        this.visible = false;
      }
      return;
    }

    const data = this.image.data;
    const width = this.world.width;
    for (let i = 0; i < fire.burning.length; i++) {
      const p = i * 4;
      if (fire.burning[i] > 0) {
        // Des flammes de l'orange au jaune, qui changent à chaque image
        const heat = this.random.next();
        data[p] = 255;
        data[p + 1] = 90 + heat * 130;
        data[p + 2] = 20 + heat * 40;
        data[p + 3] = 230;
        if (this.random.chance(SMOKE_CHANCE)) {
          onSmoke((i % width) + 0.5, Math.floor(i / width) + 0.5);
        }
      } else if (fire.scorched[i] > 0) {
        // Terre brûlée : un voile sombre qui s'estompe à mesure que la végétation repousse
        data[p] = 30;
        data[p + 1] = 22;
        data[p + 2] = 16;
        data[p + 3] = 40 + 150 * (fire.scorched[i] / SCORCH_TICKS);
      } else {
        data[p + 3] = 0;
      }
    }
    this.bufferCtx.putImageData(this.image, 0, 0);
    this.visible = true;
  }

  draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, scale: number): void {
    if (!this.visible) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.buffer,
      offsetX,
      offsetY,
      this.world.width * scale,
      this.world.height * scale,
    );
  }
}