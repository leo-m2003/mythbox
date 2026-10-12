import { beforeEach, describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('Camera', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera(256, 192);
    camera.setViewport(800, 600);
    camera.fitWorld();
  });

  it('cadre le monde entier au centre', () => {
    expect(camera.zoom).toBeCloseTo(800 / 256);
    expect(camera.x).toBe(128);
    expect(camera.y).toBe(96);
  });

  it('convertit monde → écran → monde sans perte', () => {
    const screen = camera.worldToScreen(10, 20);
    const world = camera.screenToWorld(screen.x, screen.y);
    expect(world.x).toBeCloseTo(10);
    expect(world.y).toBeCloseTo(20);
  });

  it('garde fixe le point sous le curseur pendant le zoom', () => {
    const before = camera.screenToWorld(500, 350);
    camera.zoomAt(2, 500, 350);
    const after = camera.screenToWorld(500, 350);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('borne le zoom', () => {
    for (let i = 0; i < 50; i++) camera.zoomAt(2, 400, 300);
    expect(camera.zoom).toBe(camera.maxZoom);

    for (let i = 0; i < 50; i++) camera.zoomAt(0.5, 400, 300);
    expect(camera.zoom).toBeCloseTo(camera.minZoom);
  });

  it('ne laisse pas la carte sortir de la vue', () => {
    camera.panBy(-100_000, 100_000);
    expect(camera.x).toBe(256);
    expect(camera.y).toBe(0);
  });
});