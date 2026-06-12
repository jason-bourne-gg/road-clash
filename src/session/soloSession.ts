import { Session, prepareRace } from './session';
import { world } from '../core/state';
import { createSoloPack } from '../entities/riders';
import { randomSeed } from '../core/rng';

// Single-player: a full grid of AI rivals, a random track each time.
export class SoloSession extends Session {
  readonly kind = 'solo' as const;
  begin(): void {
    prepareRace(randomSeed());      // builds the track first...
    world.riders = createSoloPack(); // ...so rider start positions are valid
  }
}
