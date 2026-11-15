// The player's preferences, kept between visits. Screens use them through this.settings.

import { loadData, saveData } from '../engine/storage';

const KEY = 'diwhy-settings';

interface SavedSettings {
  muted: boolean;
  lastName: string;
}

export class Settings {
  private data: SavedSettings = { muted: false, lastName: '', ...loadData<SavedSettings>(KEY) };

  /** Sound off everywhere. */
  get muted(): boolean {
    return this.data.muted;
  }
  set muted(on: boolean) {
    this.update({ muted: on });
  }

  /** The name you signed with last time, filled in on the contract. */
  get lastName(): string {
    return this.data.lastName;
  }
  set lastName(name: string) {
    this.update({ lastName: name });
  }

  private update(change: Partial<SavedSettings>): void {
    this.data = { ...this.data, ...change };
    saveData(KEY, this.data);
  }
}
