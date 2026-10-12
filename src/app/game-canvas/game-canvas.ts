import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { Engine } from '@engine/engine';

@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvas {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private engine?: Engine;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Le canvas n'existe dans le DOM qu'après le premier rendu du composant
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const engine = new Engine(canvas);
      this.engine = engine;

      // Adapte la résolution du canvas à sa taille réelle à l'écran
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        engine.resize(width, height, window.devicePixelRatio);
      });
      observer.observe(canvas);

      engine.start();

      destroyRef.onDestroy(() => {
        observer.disconnect();
        engine.stop();
      });
    });
  }
}