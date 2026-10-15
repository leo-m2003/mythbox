import { Random } from '../core/random';
import { SCORCH_TICKS, WET_TICKS, type Fire } from '../sim/fire';
import { World } from '../world/world';

/** Chance, à chaque image, qu'une tuile en feu lâche une volute de fumée */
const SMOKE_CHANCE = 0.03;

/** Part de SCORCH_TICKS pendant laquelle l'herbe repousse : la terre brûlée s'efface peu à peu */
const REGROWTH_PART = 0.25;
/** Part de SCORCH_TICKS, juste après le feu, pendant laquelle des braises rougeoient encore */
const EMBERS_PART = 0.1;
/** Chance, à chaque image, qu'une tuile encore chaude montre une braise */
const EMBER_CHANCE = 0.02;

/**
 * Dessine les incendies par-dessus la carte : flammes, terre brûlée et terre mouillée.
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
    if (fire.count === 0 && fire.scorchedCount === 0 && fire.wetCount === 0) {
      if (this.visible) {
        // Le dernier feu vient de s'éteindre, la terre a repoussé et séché : on efface le calque
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
        this.writeScorched(data, p, i, fire.scorched[i] / SCORCH_TICKS);
      } else if (fire.wet[i] > 0) {
        // Terre mouillée : un voile bleu sombre qui disparaît en séchant
        data[p] = 20;
        data[p + 1] = 40;
        data[p + 2] = 80;
        data[p + 3] = 70 * (fire.wet[i] / WET_TICKS);
      } else {
        data[p + 3] = 0;
      }
    }
    this.bufferCtx.putImageData(this.image, 0, 0);
    this.visible = true;
  }

  /**
   * Terre brûlée, selon `left` : 1 juste après le feu, 0 quand la prairie a repoussé.
   * Elle passe d'une cendre brun-orangé à une terre sèche ocre, puis s'efface pour laisser
   * réapparaître l'herbe.
   */
  private writeScorched(data: Uint8ClampedArray, p: number, i: number, left: number): void {
    // Encore chaude : quelques braises qui rougeoient au hasard
    if (left > 1 - EMBERS_PART && this.random.chance(EMBER_CHANCE)) {
      data[p] = 255;
      data[p + 1] = 110;
      data[p + 2] = 30;
      data[p + 3] = 255;
      return;
    }

    // 0 = cendre fraîche, 1 = terre sèche (atteint au début de la repousse)
    const dry = Math.min(1, (1 - left) / (1 - REGROWTH_PART));
    // Une petite variation fixe par tuile, pour que la terre ne soit pas d'une seule couleur.
    // (Un calcul sur l'index plutôt que le hasard : sinon, la terre scintillerait comme les flammes.)
    const grain = ((Math.imul(i, 2654435761) >>> 24) - 128) / 10;
    // Uint8ClampedArray : les valeurs hors de 0..255 sont ramenées dans l'intervalle
    data[p] = 112 + 64 * dry + grain;
    data[p + 1] = 48 + 92 * dry + grain;
    data[p + 2] = 20 + 50 * dry + grain / 2;
    // Opaque, puis de plus en plus transparent pendant la repousse
    data[p + 3] = left > REGROWTH_PART ? 255 : (255 * left) / REGROWTH_PART;
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