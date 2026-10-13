import { Component } from '@angular/core';
import { GameCanvas } from './game-canvas/game-canvas';
import { WorldBar } from './world-bar/world-bar';
import { Toolbar } from './toolbar/toolbar';
@Component({
  imports: [GameCanvas, WorldBar, Toolbar],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
