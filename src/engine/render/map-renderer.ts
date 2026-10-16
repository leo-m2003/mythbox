import { Terrain } from '../world/terrain';
import { World } from '../world/world';
import type { TileRect } from '../world/brushes';
import { sameColor, seasonColors } from './season-colors';

/**
 * Dessine la carte dans un petit canvas caché (1 pixel = 1 tuile),
 * puis le recopie agrandi sur le canvas visible.
 */
export class MapRenderer {
  private readonly buffer: OffscreenCanvas;
  private readonly bufferCtx: OffscreenCanvasRenderingContext2D;
  private readonly image: ImageData;
  /** Couleur de chaque terrain à la saison en cours (même index que l'enum Terrain) */
  private colors = seasonColors(0);

  constructor(private readonly world: World) {
    this.buffer = new OffscreenCanvas(world.width, world.height);
    const ctx = this.buffer.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible de créer le contexte 2D de la carte');
    }
    this.bufferCtx = ctx;
    this.image = ctx.createImageData(world.width, world.height);
    this.redrawAll();
  }

  /** Recalcule la couleur de toutes les tuiles */
  redrawAll(): void {
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        this.writeTile(x, y);
      }
    }
    this.bufferCtx.putImageData(this.image, 0, 0);
  }

  /**
   * Suit les saisons : à appeler à chaque image avec le pas en cours.
   * Toute la carte est redessinée, mais seulement quand une couleur a changé :
   * pendant le dernier mois de chaque saison, jamais le reste du temps.
   */
  setTime(tick: number): void {
    const colors = seasonColors(tick);
    if (colors.every((color, terrain) => sameColor(color, this.colors[terrain]))) return;
    this.colors = colors;
    this.redrawAll();
  }

  /** Recalcule seulement les tuiles d'une zone (après un coup de pinceau) */
  redrawRect(rect: TileRect): void {
    // L'ombrage d'une tuile dépend de sa voisine au nord-ouest :
    // on redessine donc aussi une colonne à droite et une rangée en dessous.
    const x1 = Math.min(this.world.width - 1, rect.x1 + 1);
    const y1 = Math.min(this.world.height - 1, rect.y1 + 1);

    for (let y = rect.y0; y <= y1; y++) {
      for (let x = rect.x0; x <= x1; x++) {
        this.writeTile(x, y);
      }
    }

    // Copie uniquement la zone modifiée vers le canvas caché
    this.bufferCtx.putImageData(
      this.image,
      0,
      0,
      rect.x0,
      rect.y0,
      x1 - rect.x0 + 1,
      y1 - rect.y0 + 1,
    );
  }

  /** Copie la carte sur le canvas visible, à la position et au zoom donnés */
  draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, scale: number): void {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.buffer,
      offsetX,
      offsetY,
      this.world.width * scale,
      this.world.height * scale,
    );
  }

  private writeTile(x: number, y: number): void {
    const i = this.world.index(x, y);
    const [r, g, b] = this.colors[this.world.terrain[i]];
    const shade = this.shadeAt(x, y);

    // Chaque pixel occupe 4 cases : rouge, vert, bleu, opacité
    const data = this.image.data;
    const p = i * 4;
    data[p] = r * shade;
    data[p + 1] = g * shade;
    data[p + 2] = b * shade;
    data[p + 3] = 255;
  }

  /** Facteur de luminosité d'une tuile (1 = couleur d'origine) */
  private shadeAt(x: number, y: number): number {
    const world = this.world;
    const i = world.index(x, y);
    const elevation = world.elevation[i];

    // Eau : plus c'est profond, plus c'est sombre
    if (world.terrain[i] <= Terrain.ShallowWater) {
      return 0.75 + elevation * 0.6;
    }

    // Terre : ombrage du relief, lumière venant du nord-ouest
    const northWest = x > 0 && y > 0 ? world.elevation[world.index(x - 1, y - 1)] : elevation;
    const shade = 1 + (elevation - northWest) * 8;
    return Math.min(1.3, Math.max(0.7, shade));
  }
}
