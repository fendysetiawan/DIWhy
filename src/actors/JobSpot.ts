// A job's spot: where a DIY job is in the house (the leaky faucet, the dryer…). Its hint floats over the art and says
// what to do, and Enter takes you to the job. Once the job is done it's gone. A job that turned up on its own may show a
// sign there until you start on it (its folder's sign.svg): the rat's shadow by the fireplace, the ghost by the sink.

import type { Character } from './Character';
import { findJobPicture } from '../state/jobs';
import { Actor } from './Actor';

export class JobSpot extends Actor {
  /** Its sign's picture, if it shows one. */
  private sign?: string;

  constructor(
    readonly job: string,
    box: { x: number; y: number; w: number; h: number },
  ) {
    super({ name: job, ...box, hidden: true });
  }

  /** Its hint, from the job as it is now: START, GO ON, or none once it's done; and its sign, if any. */
  override addTo(level: Parameters<Actor['addTo']>[0]): void {
    super.addTo(level);
    const job = level.state.jobs.find((j) => j.id === this.job);
    this.hint = job && job.status !== 'done' ? { name: job.title.toUpperCase(), does: job.status === 'open' ? 'START JOB' : 'GO ON', job: true } : undefined;
    this.sign = job?.sign ? findJobPicture(this.job, 'sign.svg') : undefined;
    this.el.hidden = !this.sign;
    this.el.classList.toggle('sign', !!this.sign);
  }

  override showTime(_night: boolean): void {
    if (this.sign) this.el.src = this.sign;
  }

  override onUse(_who: Character): void {
    this.level.startJob(this.job);
  }
}
