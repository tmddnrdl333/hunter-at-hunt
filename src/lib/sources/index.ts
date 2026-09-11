import type { SourceAdapter } from '../types';
import { engage } from './engage';
import { foodtrucks } from './foodtrucks';
import { localist } from './localist';
import { sidearm } from './sidearm';
import { wordpress } from './wordpress';

export const adapters: SourceAdapter[] = [localist, engage, wordpress, sidearm, foodtrucks];
