import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAX_BRUSH_RADIUS, MIN_BRUSH_RADIUS } from '@engine/engine';
import { GameService } from '../services/game-service';
import { TOOLS, type ToolDef } from './tools';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class Toolbar {
  protected readonly game = inject(GameService);
  protected readonly tools = TOOLS;
  protected readonly minRadius = MIN_BRUSH_RADIUS;
  protected readonly maxRadius = MAX_BRUSH_RADIUS;

  protected select(tool: ToolDef): void {
    this.game.setTool(tool.id);
  }

  protected onRadiusInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.game.setBrushRadius(input.valueAsNumber);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Laisse passer les raccourcis du navigateur (Ctrl+F, Ctrl+R…)
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.isTyping(event.target)) return;

    if (event.key === 'Escape') {
      this.game.setTool(null);
      return;
    }

    if (event.key === '+' || event.key === '=') {
      this.game.changeBrushRadius(1);
      event.preventDefault();
      return;
    }
    if (event.key === '-') {
      this.game.changeBrushRadius(-1);
      event.preventDefault();
      return;
    }

    const tool = this.tools.find((t) => t.key.toLowerCase() === event.key.toLowerCase());
    if (tool) {
      this.game.setTool(tool.id);
      event.preventDefault();
    }
  }

  /** Vrai si le joueur est en train d'écrire dans un champ de texte */
  private isTyping(target: EventTarget | null): boolean {
    if (target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLInputElement) return target.type !== 'range';
    return target instanceof HTMLElement && target.isContentEditable;
  }
}