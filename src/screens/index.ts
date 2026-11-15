// Every screen (the levels too), the game's states: one is on at a time, and this.open('Name') moves to another.
// The list is in play order; the first one starts. (Dev: number keys jump to SCREENS[n - 1].)

import { Splash } from './Splash';
import { Select } from './Select';
import { House } from './House';
import { Contract } from './Contract';
import { Yard } from '../levels/Yard';
import { Ground } from '../levels/Ground';
import { Upstairs } from '../levels/Upstairs';
import { Basement } from '../levels/Basement';
import { Diy } from './Diy';
import { Store } from './Store';
import { End } from './End';
import { Credits } from './Credits';

export const SCREENS = [Splash, Select, House, Contract, Yard, Ground, Upstairs, Basement, Diy, Store, End, Credits];
