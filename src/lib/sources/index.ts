import type { SourceAdapter } from '../types';
import { engage } from './engage';
import { localist } from './localist';
import { sidearm } from './sidearm';
import { wordpress } from './wordpress';

export const adapters: SourceAdapter[] = [localist, engage, wordpress, sidearm];
