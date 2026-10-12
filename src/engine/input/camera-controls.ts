import { Camera } from '../render/camera';

/**
 * Contrôles de la caméra :
 * - glisser avec la souris (ou le doigt) pour déplacer la vue ;
 * - molette pour zoomer, centrée sur le curseur.
 */
export class CameraControls {
  private dragging = false;
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
    canvas.addEventListener('wheel', this.onWheel, { ...options, passive: false });
    // Désactive le menu du clic droit, pour pouvoir glisser avec ce bouton
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
  }

  dispose(): void {
    this.abort.abort();
  }

  /** Rapport entre pixels du canvas et pixels CSS (écrans haute densité) */
  private get pixelRatio(): number {
    return this.canvas.width / (this.canvas.clientWidth || 1);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    // Continue de suivre la souris même si elle sort du canvas
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const ratio = this.pixelRatio;
    this.camera.panBy((e.clientX - this.lastX) * ratio, (e.clientY - this.lastY) * ratio);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this.canvas.style.cursor = '';
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // Firefox peut compter la molette en lignes plutôt qu'en pixels
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    const factor = Math.exp(-delta * 0.0015);
    const ratio = this.pixelRatio;
    this.camera.zoomAt(factor, e.offsetX * ratio, e.offsetY * ratio);
  };
}