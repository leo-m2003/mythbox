import { Camera, type Point } from '../render/camera';

/**
 * Gère la souris et le doigt sur la carte :
 * - clic droit ou bouton du milieu glissé : déplace la vue ;
 * - clic gauche : peint avec le pinceau actif, ou déplace la vue si aucun pinceau ;
 * - molette : zoom centré sur le curseur.
 * Le moteur lit `hover` et `painting` à chaque image.
 */
export class PointerInput {
  /** Position du pointeur en pixels du canvas, ou null s'il est hors de la carte */
  hover: Point | null = null;
  /** Vrai tant que le joueur maintient le clic gauche avec un pinceau */
  painting = false;

  private leftButtonPans = true;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  /** Permet de retirer tous les écouteurs d'un coup */
  private readonly abort = new AbortController();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', this.onPointerDown, options);
    canvas.addEventListener('pointermove', this.onPointerMove, options);
    canvas.addEventListener('pointerup', this.onPointerUp, options);
    canvas.addEventListener('pointercancel', this.onPointerUp, options);
    canvas.addEventListener('pointerleave', this.onPointerLeave, options);
    canvas.addEventListener('wheel', this.onWheel, { ...options, passive: false });
    // Désactive le menu du clic droit, qui sert à déplacer la vue
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
    this.updateCursor();
  }

  dispose(): void {
    this.abort.abort();
  }

  /** Avec l'outil « main », le clic gauche déplace la vue au lieu de peindre */
  setLeftButtonPans(value: boolean): void {
    this.leftButtonPans = value;
    this.updateCursor();
  }

  /** Rapport entre pixels du canvas et pixels CSS (écrans haute densité) */
  private get pixelRatio(): number {
    return this.canvas.width / (this.canvas.clientWidth || 1);
  }

  private updateHover(e: MouseEvent): void {
    const ratio = this.pixelRatio;
    this.hover = { x: e.offsetX * ratio, y: e.offsetY * ratio };
  }

  private updateCursor(): void {
    if (this.panning) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      this.canvas.style.cursor = this.leftButtonPans ? 'grab' : 'crosshair';
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    const wantsPan = e.button === 1 || e.button === 2 || (e.button === 0 && this.leftButtonPans);

    if (wantsPan) {
      this.panning = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      // Évite le défilement automatique du bouton du milieu
      e.preventDefault();
    } else if (e.button === 0) {
      this.painting = true;
    } else {
      return;
    }

    this.updateHover(e);
    // Continue de suivre le pointeur même s'il sort du canvas
    this.canvas.setPointerCapture(e.pointerId);
    this.updateCursor();
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updateHover(e);
    if (!this.panning) return;

    const ratio = this.pixelRatio;
    this.camera.panBy((e.clientX - this.lastX) * ratio, (e.clientY - this.lastY) * ratio);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.panning = false;
    this.painting = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this.updateCursor();
  };

  private onPointerLeave = (): void => {
    // Pendant un glisser, le pointeur est capturé : on garde sa position
    if (!this.panning && !this.painting) {
      this.hover = null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.updateHover(e);
    // Firefox peut compter la molette en lignes plutôt qu'en pixels
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    const factor = Math.exp(-delta * 0.0015);
    const ratio = this.pixelRatio;
    this.camera.zoomAt(factor, e.offsetX * ratio, e.offsetY * ratio);
  };
}