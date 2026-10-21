import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameService } from '../services/game-service';
import { isTyping } from '../shared/is-typing';

/**
 * Le compteur du banc d'essai : images par seconde, temps de simulation et de dessin.
 * Caché au départ, il s'affiche et se cache avec la touche ², à gauche du 1.
 */
@Component({
  selector: 'app-perf-meter',
  templateUrl: './perf-meter.html',
  styleUrl: './perf-meter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class PerfMeter {
  protected readonly game = inject(GameService);
  protected readonly visible = signal(false);

  /** Un nombre avec `digits` chiffres après la virgule, écrit à la française : 1,2 */
  protected format(value: number, digits: number): string {
    return value.toFixed(digits).replace('.', ',');
  }

  protected onKeydown(event: KeyboardEvent): void {
    // `code` est la place de la touche sur le clavier : ² sur un clavier français, ` sur un anglais
    if (event.code !== 'Backquote' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;

    this.visible.update((visible) => !visible);
    event.preventDefault();
  }
}