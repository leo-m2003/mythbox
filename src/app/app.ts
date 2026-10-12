import { Component } from '@angular/core';
import { GameCanvas } from './game-canvas/game-canvas';
import { WorldBar } from './world-bar/world-bar';
@Component({
  imports: [GameCanvas, WorldBar],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
