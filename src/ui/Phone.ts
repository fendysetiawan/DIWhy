// The phone: a popover (Popover.ts), its button bottom right with the unread badge; a click or P opens it. New texts pop up
// as toasts; click one to read it. It only draws GameState; your replies go to the GameMode.

import backIcon from '@art/icons/back.svg?raw';
import bank from '@art/icons/bank.svg?raw';
import battery from '@art/icons/battery.svg?raw';
import askbot from '@art/icons/askbot.svg?raw';
import closeIcon from '@art/icons/close.svg?raw';
import messages from '@art/icons/messages.svg?raw';
import phone from '@art/icons/phone.svg?raw';
import pinIcon from '@art/icons/pin.svg?raw';
import signal from '@art/icons/signal.svg?raw';
import wetube from '@art/icons/wetube.svg?raw';
import crack from '@art/effects/crack.svg';
import smash from '@audio/effects/ice-cracking.mp3';
import close from '@audio/ui/phone-close.wav';
import message from '@audio/ui/phone-message.wav';
import open from '@audio/ui/phone-open.wav';
import send from '@audio/ui/phone-send.wav';
import type { Game } from '../engine/Game';
import { type Contact, ROLES } from '../state/GameState';
import { findJobPicture } from '../state/jobs';
import { drawPicker } from './Picker';
import { Popover } from './Popover';
import { escapeHtml, type Toasts } from './Toast';

type Page = 'home' | 'messages' | 'chat' | 'wetube' | 'askbot';

/** A video plays this long (real seconds) before it counts as watched; AskBot types this long. */
const WATCH_MS = 3000;
const ASK_MS = 1400;

/** The phone's pixel icons (assets/art/icons/). */
const ICONS = { phone, signal, battery, messages, wetube, askbot, bank };


export class Phone extends Popover {
  private page: Page = 'home';
  private talkingTo: Contact | null = null;
  /** The video playing on WeTube, and the job AskBot is typing about, if any. */
  private playing: string | null = null;
  private asking: string | null = null;
  /** How many messages of each chat were on screen last time: only newer ones pop in. */
  private seen: Partial<Record<Contact, number>> = {};
  /** Which of your possible replies is in the box (◀ ▶ change it). */
  private pick = 0;

  constructor(
    game: Game,
    private readonly toasts: Toasts,
  ) {
    super(game, { name: 'phone', key: 'phone', sounds: { open, close } });
    this.el.setAttribute('aria-label', 'Phone');
    this.el.addEventListener('click', (e) => this.handleClick(e));
    game.controls.onAction('up', () => this.moveFocus(-1));
    game.controls.onAction('down', () => this.moveFocus(1));
    game.controls.onAction('left', () => this.changePick(-1));
    game.controls.onAction('right', () => this.changePick(1));
    game.state.subscribe('chats', () => this.render());
    game.state.subscribe('jobs', () => {
      if (this.page === 'wetube' || this.page === 'askbot') this.render();
    });
    game.state.subscribe('cracked', () => this.crack());
    game.state.subscribe('text', () => this.notify());
    game.state.subscribe('clock', () => {
      for (const el of this.el.querySelectorAll('.phone-time')) el.textContent = this.drawClock();
    });
    this.render();
  }

  /** Show its button (once you're playing) or hide everything, toasts too (the intro, the end). */
  override setShown(shown: boolean): void {
    super.setShown(shown);
    if (!shown) this.toasts.clear();
  }

  /** A text arrived: a ding, and a toast (click it to read) unless you're reading that chat. */
  private notify(): void {
    const last = this.game.state.lastText;
    if (!last || !this.isShown) return;
    this.game.sound.play(message, 0.5);
    if (this.isReading(last.from)) {
      this.game.session.read(last.from);
      return;
    }
    if (this.isUp) return; // the badge is enough while it's open
    this.toasts.show({
      icon: this.drawAvatar(last.from),
      title: this.nameOf(last.from),
      text: last.text,
      onClick: () => this.goTo('chat', last.from),
    });
  }

  /** Your phone hit the floor: a smash, a shake, and from now on a crack across the screen. */
  private crack(): void {
    this.game.sound.play(smash, 0.6);
    this.el.classList.add('shake');
    this.button.classList.add('shake');
    window.setTimeout(() => {
      this.el.classList.remove('shake');
      this.button.classList.remove('shake');
    }, 700);
    this.render();
  }

  /** Just opened: the toasts go (you're reading), and the first button has focus. */
  protected override onOpen(): void {
    this.toasts.clear();
    this.focusFirst();
  }

  /** Open someone's chat (a visitor you talk to, say). */
  openChat(contact: Contact): void {
    this.goTo('chat', contact);
  }

  /** Go to a page of the phone (it opens if it isn't). */
  private goTo(page: Page, talkingTo: Contact | null = null): void {
    this.page = page;
    this.talkingTo = talkingTo;
    this.pick = 0;
    if (!this.isUp) this.setOpen(true);
    else this.render();
    if (talkingTo) this.game.session.read(talkingTo);
    this.focusFirst(); // in a chat: Enter sends
  }

  /** Focus where you'd start: in a chat, Send (Enter sends); elsewhere, the first button. */
  private focusFirst(): void {
    (this.el.querySelector<HTMLButtonElement>('.picker-text') ?? this.el.querySelector<HTMLButtonElement>('.phone-view button'))?.focus();
  }

  /** Arrow keys, while it's up: move through its buttons. */
  private moveFocus(step: number): void {
    if (!this.isUp) return;
    const buttons = [...this.el.querySelectorAll<HTMLButtonElement>('.phone-view button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[i < 0 ? 0 : (i + step + buttons.length) % buttons.length]?.focus();
  }

  /** Show the next (1) or previous (-1) reply in the box (or question, on AskBot). */
  private changePick(step: number): void {
    const replies =
      this.isUp && this.page === 'askbot'
        ? this.askable().map((j) => j.prep.ask.question)
        : this.talkingTo && this.isUp && this.page === 'chat'
          ? this.game.state.chats[this.talkingTo].replies
          : [];
    if (!replies.length) return;
    this.pick = (this.pick + step + replies.length) % replies.length;
    const draft = this.el.querySelector('.picker-text');
    if (draft) draft.textContent = replies[this.pick];
  }

  // ─── WeTube and AskBot: prep for a job ───

  /** The jobs you can prep for: there, and not done yet. */
  private preppable() {
    return this.game.state.jobs.filter((j) => j.status !== 'done');
  }

  /** The jobs AskBot hasn't been asked about. */
  private askable() {
    return this.preppable().filter((j) => !j.prep.asked);
  }

  /** WeTube: a video for each job; tap one and it plays (a bar fills), then it counts as watched. */
  private drawVideos(): string {
    const jobs = this.preppable();
    if (!jobs.length) return '<p class="phone-note">Nothing to watch. Go fix something.</p>';
    return `<div class="phone-list">${jobs
      .map((j) => {
        const { title, channel, length } = j.prep.video;
        const state = j.prep.watched ? '<i class="badge watched">WATCHED</i>' : this.playing === j.id ? '<span class="wetube-bar"><i></i></span>' : '';
        return `<button type="button" data-watch="${j.id}" ${j.prep.watched || this.playing ? 'disabled' : ''}>
          <span class="wetube-thumb" style="background-image: url('${findJobPicture(j.id, 'backdrop.png')}')"><i>${length}</i></span>
          <span class="phone-meta"><b>${escapeHtml(title)}</b><span class="phone-preview">${escapeHtml(channel)}</span>${state}</span></button>`;
      })
      .join('')}</div>`;
  }

  /** AskBot: what you asked and what it said (and skipped), and the picker with the next question. */
  private drawAskBot(): string {
    const asked = this.preppable().filter((j) => j.prep.asked);
    const chat = asked
      .map((j) => `<p class="mine">${escapeHtml(j.prep.ask.question)}</p><p>${escapeHtml(j.prep.ask.answer)}</p>`)
      .join('');
    const typing = this.asking ? '<p class="typing" aria-label="typing"><i></i><i></i><i></i></p>' : '';
    const questions = this.askable();
    this.pick = Math.min(this.pick, Math.max(0, questions.length - 1));
    const compose = questions.length && !this.asking ? `<div class="phone-compose">${drawPicker(questions[this.pick].prep.ask.question, questions.length > 1)}</div>` : '';
    return `<div class="phone-chat">${chat || '<p>Hi! Ask me anything about DIY. I am always confident.</p>'}${typing}</div>${compose}`;
  }

  /** Play a job's video; once it's done, it counts (and the clock jumps on). */
  private watch(job: string): void {
    if (this.playing) return;
    this.playing = job;
    this.render();
    window.setTimeout(() => {
      this.playing = null;
      this.game.session.watch(job).finally(() => this.render());
    }, WATCH_MS);
  }

  /** Ask AskBot the question in the box; it types, then answers. */
  private ask(): void {
    const job = this.askable()[this.pick];
    if (!job || this.asking) return;
    this.game.sound.play(send, 0.4);
    this.asking = job.id;
    this.render();
    window.setTimeout(() => {
      this.asking = null;
      this.pick = 0;
      this.game.session.ask(job.id).finally(() => this.render());
    }, ASK_MS);
  }

  private isReading(c: Contact): boolean {
    return this.isUp && this.page === 'chat' && this.talkingTo === c;
  }

  private reply(text: string): void {
    if (!this.talkingTo) return;
    this.game.sound.play(send, 0.4);
    this.game.session.reply(this.talkingTo, text);
    this.pick = 0;
  }

  /** Its buttons say what they do in data attributes. */
  private handleClick(e: Event): void {
    e.stopPropagation();
    const button = (e.target as HTMLElement).closest('button');
    const { go, chat, pick, watch } = button?.dataset ?? {};
    if (go === '' && this.page === 'askbot') this.ask(); // the picker's question
    else if (go === '' && this.talkingTo) this.reply(this.game.state.chats[this.talkingTo].replies[this.pick]); // the picker's send
    else if (watch) this.watch(watch);
    else if (go === 'close') this.setOpen(false);
    else if (go) this.goTo(go as Page);
    else if (chat) this.goTo('chat', chat as Contact);
    else if (pick) this.changePick(Number(pick));
  }

  protected render(): void {
    const { state } = this.game;
    const unread = Object.values(state.chats).reduce((sum, chat) => sum + chat.unread, 0);
    this.button.innerHTML = `${ICONS.phone}${unread ? `<i class="badge">${unread}</i>` : ''}`;
    this.button.setAttribute('aria-label', `${this.isUp ? 'Put the phone away' : 'Open the phone'} (P)${unread ? `, ${unread} unread` : ''}`);
    this.el.classList.toggle('night', state.night);
    this.el.classList.toggle('cracked', state.phoneCracked);
    this.el.dataset.page = this.page;
    this.el.innerHTML = `
      <div class="phone-body">
        <div class="phone-bar">
          <span class="phone-time">${this.drawClock()}</span>
          ${unread ? `<i class="badge">${unread}</i>` : ''}
          ${ICONS.signal}${ICONS.battery}
          <button class="phone-close" type="button" data-go="close" aria-label="Put the phone away (P)">${closeIcon}</button>
        </div>
        <div class="phone-view">${this.drawPage(unread)}</div>
        ${state.phoneCracked ? `<img class="phone-crack" src="${crack}" alt="" />` : ''}
        <button class="phone-home" type="button" data-go="home" aria-label="Home"></button>
      </div>`;
    const chat = this.el.querySelector('.phone-chat');
    if (chat) chat.scrollTop = chat.scrollHeight; // always at the newest message
    if (this.talkingTo) this.seen[this.talkingTo] = state.chats[this.talkingTo].messages.length;
    if (this.isUp && document.activeElement === document.body) this.focusFirst(); // redrawn: keep your place
  }

  private drawPage(unread: number): string {
    const { state } = this.game;
    const head = (title: string, to: Page) =>
      `<header class="phone-head"><button class="phone-back" type="button" data-go="${to}" aria-label="Back">${backIcon}</button>${title}</header>`;
    switch (this.page) {
      case 'home':
        return `<div class="phone-homescreen">
            <p class="phone-clock"><span class="phone-time">${this.drawClock()}</span></p>
            <div class="phone-apps">
              <button type="button" data-go="messages">${ICONS.messages}MESSAGES${unread ? `<i class="badge">${unread}</i>` : ''}</button>
              <button type="button" data-go="wetube">${ICONS.wetube}WETUBE</button>
              <button type="button" data-go="askbot">${ICONS.askbot}ASKBOT</button>
            </div>
            <p class="phone-note">Watch a video or ask AskBot before a job. Videos are slow but right; AskBot is quick but sloppy.</p>
          </div>`;
      case 'messages':
        return `${head('<b>MESSAGES</b>', 'home')}<div class="phone-list">${(Object.keys(state.chats) as Contact[])
          .map((c) => {
            const last = state.chats[c].messages.at(-1);
            return `<button type="button" data-chat="${c}">${this.drawAvatar(c)}
              <span class="phone-meta"><b>${this.nameOf(c)}</b>
              <span class="phone-preview">${state.chats[c].typing ? 'typing…' : `${last?.mine ? 'You: ' : ''}${escapeHtml(last?.text ?? '')}`}</span></span>
              ${state.chats[c].unread ? `<i class="badge">${state.chats[c].unread}</i>` : ''}</button>`;
          })
          .join('')}</div>`;
      case 'chat': {
        const c = this.talkingTo as Contact;
        const who = `${this.drawAvatar(c)}<b>${this.nameOf(c)}</b>`;
        const { replies } = state.chats[c];
        this.pick = Math.min(this.pick, Math.max(0, replies.length - 1));
        // your reply waits at the bottom, in your colour: ◀ ▶ for the others, click it to send
        const compose = `<div class="phone-compose">${drawPicker(replies[this.pick] ?? '', replies.length > 1)}</div>`;
        return `${head(who, 'messages')}
          ${c === 'contractor' && state.takeover.money ? `<p class="phone-pinned" aria-label="Pinned: their quote to finish it all">${pinIcon}<span>$${Math.round(state.takeover.money / 1000)}K · ${state.takeover.days} DAYS</span></p>` : ''}
          <div class="phone-chat">${state.chats[c].messages.map((m, i) => `<p class="${m.mine ? 'mine' : ''}${i >= (this.seen[c] ?? Infinity) ? ' new' : ''}">${escapeHtml(m.text)}</p>`).join('')}${state.chats[c].typing ? '<p class="typing" aria-label="typing"><i></i><i></i><i></i></p>' : ''}</div>
          ${replies.length ? compose : ''}`;
      }
      case 'wetube':
        return `${head('<b>WETUBE</b>', 'home')}${this.drawVideos()}`;
      case 'askbot':
        return `${head('<b>ASKBOT</b>', 'home')}${this.drawAskBot()}`;
    }
  }

  /** The time, in ten-minute steps. */
  private drawClock(): string {
    const m = Math.floor((this.game.state.minutes % (24 * 60)) / 10) * 10;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  private drawAvatar(c: Contact): string {
    return `<span class="avatar">${c === 'bank' ? ICONS.bank : `<img src="${this.game.state.cast[c].idle('front')}" alt="" />`}</span>`;
  }

  /** Who they are to you (Partner, Contractor…): that's how they're saved in your phone. */
  private nameOf(c: Contact): string {
    return c === 'bank' ? 'Bank' : ROLES[c];
  }
}
