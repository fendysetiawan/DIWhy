// The hardware store: a step needs a tool you don't have, so you drive over. The clerk (whoever plays the role) is
// behind the counter, and their card pitches each kind: the cheap one (a corner cut), the right one, and the fancy one
// they'd love to sell you. ◀ ▶ for another, click it to buy; LEAVE (or after buying, BACK) goes back to the job.

import back from '@art/levels/store/back.png';
import counter from '@art/levels/store/counter.png';
import bell from '@audio/effects/store-door-bell.mp3';
import music from '@audio/music/temptation.mp3';
import coins from '@audio/ui/coins.wav';
import type { ToolView } from '../../shared/game';
import { Screen } from '../engine/Screen';
import { drawHead } from '../ui/Card';
import { drawPicker } from '../ui/Picker';
import { escapeHtml } from '../ui/Toast';

interface StoreData {
  tool: string;
  /** The DIY job to go back to (what the Diy screen was opened with). */
  back: unknown;
}

export class Store extends Screen {
  static key = 'Store';

  private data!: StoreData;
  /** The clerk's card. */
  private card!: HTMLElement;
  /** The option in the picker. */
  private pick = 0;
  private buying = false;

  create(data: StoreData) {
    this.data = data;
    this.sound.playMusic(music);
    this.sound.play(bell, 0.6);
    this.el.classList.add('store');
    const clerk = this.state.cast.clerk;
    const you = this.state.player;
    this.el.innerHTML = `
      <div class="set" aria-hidden="true">
        <img class="set-backdrop" src="${back}" alt="" />
        ${clerk ? `<img class="store-clerk" src="${clerk.idle('front')}" alt="" />` : ''}
        <img class="set-backdrop" src="${counter}" alt="" />
        ${you ? `<img class="store-you" src="${you.idle('back')}" alt="" />` : ''}
      </div>
      <div class="popup"><section class="card" role="dialog" aria-label="The store"></section></div>`;
    this.card = this.el.querySelector('.card') as HTMLElement;
    this.card.addEventListener('click', (e) => this.handleClick(e));
    this.controls.onAction('left', () => this.move(-1));
    this.controls.onAction('right', () => this.move(1));
    this.onChange('tools', () => this.render());
    this.render();
  }

  private findTool(): ToolView | undefined {
    return this.state.tools.find((t) => t.id === this.data.tool);
  }

  /** The clerk's card: what you need and their pitch for the kind you're on, the picker to buy it, LEAVE; or their
   * verdict on what you bought. */
  private render(): void {
    const tool = this.findTool();
    const clerk = this.state.cast.clerk;
    if (!tool || !clerk) return;
    const face = clerk.idle('front');
    if (tool.owned) {
      const said = this.state.lastBought?.tool === tool.id ? this.state.lastBought.text : 'Come back soon!';
      this.card.innerHTML = `${drawHead(face, 'GOT IT!')}<p>"${escapeHtml(said)}"</p>
        <button type="button" class="button" data-back>BACK TO THE JOB</button>`;
      this.card.querySelector<HTMLButtonElement>('[data-back]')?.focus();
      return;
    }
    const option = tool.options[this.pick];
    this.card.innerHTML = `${drawHead(face, escapeHtml(tool.name.toUpperCase()))}<p>"${escapeHtml(option.pitch)}"</p>
      ${drawPicker(this.labelOption(tool, this.pick), tool.options.length > 1)}
      <button type="button" class="button secondary" data-back>LEAVE</button>`;
    this.card.querySelector<HTMLButtonElement>('[data-go]')?.focus();
  }

  /** An option, its price, and who recommends it: the clerk (the fancy one), and your WeTube video or AskBot. */
  private labelOption(tool: ToolView, i: number): string {
    const option = tool.options[i];
    const tags = [
      i === tool.options.length - 1 ? "CLERK'S PICK" : '',
      tool.tips.video === i ? 'WETUBE PICK' : '',
      tool.tips.ask === i ? 'ASKBOT PICK' : '',
    ].filter(Boolean);
    return [`${option.name} · $${option.price}`, ...tags].join(' · ');
  }

  private handleClick(e: Event): void {
    const { pick, go, back } = (e.target as HTMLElement).closest('button')?.dataset ?? {};
    if (pick) this.move(Number(pick));
    else if (go !== undefined) this.buy();
    else if (back !== undefined) this.open('Diy', this.data.back);
  }

  /** ← →: the next option. */
  private move(step: number): void {
    const tool = this.findTool();
    if (!tool || tool.owned || this.game.hud.isBusy) return;
    this.pick = (this.pick + step + tool.options.length) % tool.options.length;
    this.render();
  }

  private buy(): void {
    if (this.buying) return;
    this.buying = true;
    this.sound.play(coins, 0.5);
    this.game.session.buy(this.data.tool, this.pick).finally(() => {
      this.buying = false;
    });
  }
}
