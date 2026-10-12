export interface Point {
  x: number;
  y: number;
}

/**
 * La caméra : quelle partie du monde est visible, et à quel zoom.
 * Coordonnées « monde » = en tuiles. Coordonnées « écran » = en pixels du canvas.
 * Aucune dépendance au DOM : c'est de la géométrie pure, donc testable.
 */
export class Camera {
  /** Point du monde (en tuiles) affiché au centre de l'écran */
  x: number;
  y: number;
  /** Nombre de pixels écran par tuile */
  zoom = 1;

  readonly maxZoom = 48;

  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;
  }

  get hasViewport(): boolean {
    return this.viewportWidth > 0 && this.viewportHeight > 0;
  }

  /** Zoom qui montre le monde entier à l'écran */
  private get fitZoom(): number {
    return Math.min(this.viewportWidth / this.worldWidth, this.viewportHeight / this.worldHeight);
  }

  /** On peut dézoomer un peu au-delà du monde entier, pas plus */
  get minZoom(): number {
    return this.fitZoom * 0.75;
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.zoom = this.clampZoom(this.zoom);
  }

  /** Recentre la caméra et cadre le monde entier */
  fitWorld(): void {
    this.zoom = this.fitZoom;
    this.x = this.worldWidth / 2;
    this.y = this.worldHeight / 2;
  }

  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: (worldX - this.x) * this.zoom + this.viewportWidth / 2,
      y: (worldY - this.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.viewportWidth / 2) / this.zoom + this.x,
      y: (screenY - this.viewportHeight / 2) / this.zoom + this.y,
    };
  }

  /** Déplace la vue d'un certain nombre de pixels écran (glisser la carte) */
  panBy(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clampPosition();
  }

  /** Zoome en gardant fixe le point du monde situé sous le curseur */
  zoomAt(factor: number, screenX: number, screenY: number): void {
    const before = this.screenToWorld(screenX, screenY);
    this.zoom = this.clampZoom(this.zoom * factor);
    const after = this.screenToWorld(screenX, screenY);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampPosition();
  }

  private clampZoom(zoom: number): number {
    if (!this.hasViewport) return zoom;
    return Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
  }

  /** Empêche de perdre la carte de vue : le centre de l'écran reste sur le monde */
  private clampPosition(): void {
    this.x = Math.min(this.worldWidth, Math.max(0, this.x));
    this.y = Math.min(this.worldHeight, Math.max(0, this.y));
  }
}