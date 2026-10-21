/** Ce que mesure le banc d'essai, en moyenne sur les dernières images */
export interface FrameStats {
  /** Images par seconde */
  fps: number;
  /** Temps passé à faire avancer la simulation, en millisecondes par image */
  simulationMs: number;
  /** Le plus long temps de simulation d'une seule image, en millisecondes */
  worstSimulationMs: number;
  /** Temps passé à tout le reste de l'image, surtout le dessin, en millisecondes par image */
  drawMs: number;
}

/**
 * Le banc d'essai : additionne ce que prennent les images, puis en donne la moyenne.
 * Le moteur lui ajoute chaque image, et lui reprend les moyennes avec le résumé du monde.
 */
export class FrameMeter {
  private frames = 0;
  private seconds = 0;
  private simulationMs = 0;
  private worstSimulationMs = 0;
  private drawMs = 0;

  /** Une image de plus, qui a duré `seconds` secondes : `simulationMs` et `drawMs` de calcul */
  add(seconds: number, simulationMs: number, drawMs: number): void {
    this.frames++;
    this.seconds += seconds;
    this.simulationMs += simulationMs;
    this.worstSimulationMs = Math.max(this.worstSimulationMs, simulationMs);
    this.drawMs += drawMs;
  }

  /** Les moyennes des images ajoutées depuis le dernier appel (0 s'il n'y en a pas), puis oublie */
  take(): FrameStats {
    const frames = Math.max(1, this.frames);
    const stats: FrameStats = {
      fps: this.seconds > 0 ? this.frames / this.seconds : 0,
      simulationMs: this.simulationMs / frames,
      worstSimulationMs: this.worstSimulationMs,
      drawMs: this.drawMs / frames,
    };
    this.frames = 0;
    this.seconds = 0;
    this.simulationMs = 0;
    this.worstSimulationMs = 0;
    this.drawMs = 0;
    return stats;
  }
}