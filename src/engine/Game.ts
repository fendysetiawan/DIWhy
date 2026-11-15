// The game. Like Phaser's: give it the screens, it starts the first and runs the loop.

import { GameState } from '../state/GameState';
import { Settings } from '../state/Settings';
import { ControlsManager } from './ControlsManager';
import { GameLoop } from './GameLoop';
import type { ScreenClass } from './Screen';
import { ScreenManager } from './ScreenManager';
import { SoundManager } from './SoundManager';
import { Hud } from '../ui/Hud';
import { Session } from '../state/Session';

interface GameConfig {
  /** id of the element the game draws into */
  parent: string;
  /** every screen; the first one starts */
  screens: ScreenClass[];
}

export class Game {
  readonly settings = new Settings();
  readonly state = new GameState();
  readonly controls = new ControlsManager();
  readonly sound = new SoundManager();
  readonly screens: ScreenManager;
  readonly loop = new GameLoop();
  /** Your session with the game on the server: start it, send what you do, keep GameState up to date. */
  readonly session = new Session(this.state);
  /** What stays on top of every screen: the sound button, the meters, the phone. */
  readonly hud: Hud;

  constructor(config: GameConfig) {
    const root = document.getElementById(config.parent);
    if (!root) throw new Error(`No element with id "${config.parent}"`);
    this.sound.setMuted(this.settings.muted);
    this.screens = new ScreenManager(this, root, config.screens);
    this.hud = new Hud(this);
    this.loop.start((dt) => {
      this.screens.update(dt);
      if (this.screens.playing) this.session.update(dt);
      this.hud.update();
    });
    this.screens.start(config.screens[0].key);
    this.state.subscribe('burnedOut', () => this.screens.start('End', { result: 'burnedOut' })); // health hit zero: game over
  }

  /** You give up: the contractor takes over, and their bill is the end screen. Play again from there starts fresh. */
  giveUp(): void {
    this.session.giveUp().finally(() => this.screens.start('End', { result: 'giveUp' }));
  }
}
