import { describe, it, expect } from 'vitest';
import { FrameMeter } from './frame-meter';

describe('FrameMeter', () => {
  it('donne les images par seconde et les temps moyens par image', () => {
    const meter = new FrameMeter();
    // 4 images de 1/60 s : la simulation prend 1, 3, 1 et 3 ms, le dessin 2 ms
    for (const simulation of [1, 3, 1, 3]) meter.add(1 / 60, simulation, 2);
    const stats = meter.take();
    expect(stats.fps).toBeCloseTo(60);
    expect(stats.simulationMs).toBe(2);
    expect(stats.worstSimulationMs).toBe(3);
    expect(stats.drawMs).toBe(2);
  });

  it('repart de zéro à chaque relevé', () => {
    const meter = new FrameMeter();
    meter.add(1 / 30, 5, 5);
    meter.take();
    // Aucune image depuis le dernier relevé : tout est à 0, sans division par zéro
    expect(meter.take()).toEqual({ fps: 0, simulationMs: 0, worstSimulationMs: 0, drawMs: 0 });
    meter.add(1 / 30, 1, 4);
    expect(meter.take()).toEqual({
      fps: 30,
      simulationMs: 1,
      worstSimulationMs: 1,
      drawMs: 4,
    });
  });
});