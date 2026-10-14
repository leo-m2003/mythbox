import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SIM_SPEEDS, type SimSpeed } from '@engine/sim/sim-clock';
import { GameService } from '../services/game-service';
import { isTyping } from '../shared/is-typing';

@Component({
  selector: 'app-time-bar',
  templateUrl: './time-bar.html',
  styleUrl: './time-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class TimeBar {
  protected readonly game = inject(GameService);
  /** Les vitesses hors pause : x1, x2, x5 */
  protected readonly speeds = SIM_SPEEDS.filter((s): s is Exclude<SimSpeed, 0> => s !== 0);

  protected onKeydown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;
    // Espace sur un bouton qui a le focus le « clique » déjà : on le laisse faire
    if (event.target instanceof HTMLButtonElement) return;

    this.game.togglePause();
    // Évite que la page défile
    event.preventDefault();
  }
}