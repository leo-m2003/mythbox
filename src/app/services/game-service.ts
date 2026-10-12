import { Injectable, signal } from '@angular/core';
import { Engine } from '@engine/engine';

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

  /** Appelé par le composant canvas quand le moteur est prêt */
  attach(engine: Engine): void {
    this.engine = engine;
    this.seedState.set(engine.seed);
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
}