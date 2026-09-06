import {
  type ScheduleCallback,
  debounce as _debounce,
  throttle as _throttle,
  leadingAndTrailing,
} from '@solid-primitives/scheduled';

export { createScheduled } from '@solid-primitives/scheduled';

export const throttle: ScheduleCallback = (fn, wait = 100) =>
  leadingAndTrailing(_throttle, fn, wait);

export const debounce: ScheduleCallback = (fn, wait = 100) =>
  _debounce(fn, wait);
