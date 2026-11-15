// Boot: make the game with its screens (the first one starts).

import './style.css';
import { Game } from './engine/Game';
import { SCREENS } from './screens';

const game = new Game({ parent: 'app', screens: SCREENS });

if (import.meta.env.DEV) {
  game.controls.addDevHotkeys(game, SCREENS);
  (window as unknown as { game: Game }).game = game; // for screenshots/capture.ts
}
