import { Injectable, signal } from '@angular/core';
import { Engine, MAX_BRUSH_RADIUS, MIN_BRUSH_RADIUS } from '@engine/engine';
import type { BrushKind } from '@engine/world/brushes';

/**
 * Pont entre l'interface Angular et le moteur de jeu.
 * Les composants d'interface passent toujours par ce service.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private engine?: Engine;

  private readonly seedState = signal<number | null>(null);
  /** Graine du monde affiché */
  readonly seed = this.seedState.asReadonly();

  private readonly toolState = signal<BrushKind | null>(null);
  /** Pinceau actif, ou null pour l'outil « main » */
  readonly tool = this.toolState.asReadonly();

  private readonly brushRadiusState = signal(4);
  /** Rayon du pinceau, en tuiles */
  readonly brushRadius = this.brushRadiusState.asReadonly();

  /** Appelé par le composant canvas quand le moteur est prêt */
  attach(engine: Engine): void {
    this.engine = engine;
    this.seedState.set(engine.seed);
    // Le service fait référence : on transmet ses réglages au moteur
    engine.setBrush(this.toolState());
    engine.setBrushRadius(this.brushRadiusState());
  }

  detach(): void {
    this.engine = undefined;
  }

  newWorld(seed?: number): void {
    if (!this.engine) return;
    this.engine.newWorld(seed);
    this.seedState.set(this.engine.seed);
  }

  resetView(): void {
    this.engine?.resetView();
  }

  setTool(tool: BrushKind | null): void {
    this.toolState.set(tool);
    this.engine?.setBrush(tool);
  }

  setBrushRadius(radius: number): void {
    const clamped = Math.min(MAX_BRUSH_RADIUS, Math.max(MIN_BRUSH_RADIUS, Math.round(radius)));
    this.brushRadiusState.set(clamped);
    this.engine?.setBrushRadius(clamped);
  }

  changeBrushRadius(delta: number): void {
    this.setBrushRadius(this.brushRadiusState() + delta);
  }
}