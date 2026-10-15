import { Injectable, signal } from '@angular/core';
import { Engine, MAX_BRUSH_RADIUS, MIN_BRUSH_RADIUS, type WorldSummary } from '@engine/engine';
import type { SimSpeed } from '@engine/sim/sim-clock';
import { HAND, type Tool } from '@engine/tool';

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

  private readonly toolState = signal<Tool>(HAND);
  /** Outil tenu par le dieu : main, pinceau ou pouvoir */
  readonly tool = this.toolState.asReadonly();

  private readonly brushRadiusState = signal(4);
  /** Rayon du pinceau, en tuiles */
  readonly brushRadius = this.brushRadiusState.asReadonly();

  private readonly speedState = signal<SimSpeed>(1);
  /** Vitesse de la simulation (0 = pause) */
  readonly speed = this.speedState.asReadonly();

  private readonly yearState = signal(1);
  /** Année en cours dans le monde */
  readonly year = this.yearState.asReadonly();

  private readonly monthState = signal(1);
  /** Mois dans l'année en cours */
  readonly month = this.monthState.asReadonly();

  private readonly dayState = signal(1);
  /** Jour dans le mois en cours */
  readonly day = this.dayState.asReadonly();

  private readonly populationState = signal(0);
  /** Nombre d'habitants vivants */
  readonly population = this.populationState.asReadonly();

  private readonly villagesState = signal(0);
  /** Nombre de villages */
  readonly villages = this.villagesState.asReadonly();

  /** Vitesse à retrouver en sortant de la pause */
  private resumeSpeed: Exclude<SimSpeed, 0> = 1;

  /** Appelé par le composant canvas quand le moteur est prêt */
  attach(engine: Engine): void {
    this.engine = engine;
    this.seedState.set(engine.seed);
    // Le service fait référence : on transmet ses réglages au moteur
    engine.setTool(this.toolState());
    engine.setBrushRadius(this.brushRadiusState());
    engine.setSpeed(this.speedState());

    // Le moteur envoie son résumé quelques fois par seconde
    engine.onSummary = (summary) => this.applySummary(summary);
    this.applySummary(engine.summary());
  }

  detach(): void {
    if (this.engine) {
      this.engine.onSummary = undefined;
    }
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

  setTool(tool: Tool): void {
    this.toolState.set(tool);
    this.engine?.setTool(tool);
  }

  setBrushRadius(radius: number): void {
    const clamped = Math.min(MAX_BRUSH_RADIUS, Math.max(MIN_BRUSH_RADIUS, Math.round(radius)));
    this.brushRadiusState.set(clamped);
    this.engine?.setBrushRadius(clamped);
  }

  changeBrushRadius(delta: number): void {
    this.setBrushRadius(this.brushRadiusState() + delta);
  }

  setSpeed(speed: SimSpeed): void {
    if (speed !== 0) {
      this.resumeSpeed = speed;
    }
    this.speedState.set(speed);
    this.engine?.setSpeed(speed);
  }

  /** Met en pause, ou reprend à la vitesse d'avant */
  togglePause(): void {
    this.setSpeed(this.speedState() === 0 ? this.resumeSpeed : 0);
  }

  /** Recopie le résumé du moteur dans les signals (un signal inchangé ne redessine rien) */
  private applySummary(summary: WorldSummary): void {
    this.yearState.set(summary.year);
    this.monthState.set(summary.month);
    this.dayState.set(summary.day);
    this.populationState.set(summary.population);
    this.villagesState.set(summary.villages);
  }
}