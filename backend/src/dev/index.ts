// Dev mode entry point. Loaded with a dynamic import, only when dev mode is switched on.
//
// It draws a panel from the `debug` payload the backend returns, and can ask the app to replay
// the current seed under a different director. It knows the backend only through DevHost and
// the JSON contract, so it works the same against a remote server.

import type { DevHost } from '../devHost';
import './dev.css';
import { renderPanel, type PanelMemory } from './panel';

const freshMemory = (): PanelMemory => ({ prev: {}, open: new Map() });

/** Turn dev mode on. Returns a function that turns it off again. */
export function mountDev(host: DevHost, el: HTMLElement): () => void {
  let memory = freshMemory();
  let gameId = '';

  const draw = () => {
    const game = host.game();
    if (!game || !game.debug) {
      el.innerHTML = `<h3>Dev mode</h3><p class="muted">${game ? 'Loading debug data...' : 'Loading...'}</p>`;
      return;
    }
    if (game.id !== gameId) {
      gameId = game.id; // a new game: forget the old one's highlights and open sections
      memory = freshMemory();
    }
    renderPanel(el, {
      game,
      debug: game.debug,
      busy: host.busy(),
      memory,
      onSetDirector: (name) => void host.setDirector(name),
    });
  };

  const off = host.subscribe(draw);
  draw();
  return () => {
    off();
    el.innerHTML = '';
  };
}
