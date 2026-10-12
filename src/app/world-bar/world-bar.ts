import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { seedFromText } from '@engine/core/seed';
import { GameService } from '../services/game-service';

@Component({
  selector: 'app-world-bar',
  templateUrl: './world-bar.html',
  styleUrl: './world-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldBar {
  protected readonly game = inject(GameService);
  protected readonly seedError = signal(false);

  protected newWorld(): void {
    this.seedError.set(false);
    this.game.newWorld();
  }

  protected loadSeed(event: Event, text: string): void {
    // Sans FormsModule, le formulaire rechargerait la page
    event.preventDefault();

    const seed = seedFromText(text);
    if (seed === null) {
      this.seedError.set(true);
      return;
    }
    this.seedError.set(false);
    this.game.newWorld(seed);
  }
}