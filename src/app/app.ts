import { Component } from '@angular/core';
import { GameCanvas } from './game-canvas/game-canvas';
import { WorldBar } from './world-bar/world-bar';
import { Toolbar } from './toolbar/toolbar';
import { TimeBar } from './time-bar/time-bar';
import { PerfMeter } from './perf-meter/perf-meter';
@Component({
  imports: [GameCanvas, WorldBar, Toolbar, TimeBar, PerfMeter],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}