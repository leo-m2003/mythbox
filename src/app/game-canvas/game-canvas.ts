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
import { GameService } from '../services/game-service';
import { BrushKind } from '@engine/world/brushes';

@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvas {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly game = inject(GameService);

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Le canvas n'existe dans le DOM qu'après le premier rendu du composant
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const engine = new Engine(canvas);

      // Adapte la résolution du canvas à sa taille réelle à l'écran
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        engine.resize(width, height, window.devicePixelRatio);
      });
      observer.observe(canvas);

      engine.start();
      engine.setBrush(BrushKind.Raise); // TEMPORAIRE : retiré à l'étape 3
      this.game.attach(engine);

      destroyRef.onDestroy(() => {
        this.game.detach();
        observer.disconnect();
        engine.destroy();
      });
    });
  }
}