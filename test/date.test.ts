import { describe, it, expect } from 'vitest';
import { isCalendarDate, slugFromDate, todayInMeetupTimezone } from '@/events/date.ts';

describe('todayInMeetupTimezone', () => {
  it('uses New Hampshire time, so a late evening there is still the same day', () => {
    // 02:30 UTC on Nov 19 is 9:30 PM on Nov 18 in New Hampshire.
    expect(todayInMeetupTimezone(new Date('2026-11-19T02:30:00Z'))).toBe('2026-11-18');
  });
  it('rolls over at local midnight', () => {
    expect(todayInMeetupTimezone(new Date('2026-11-19T05:00:00Z'))).toBe('2026-11-19');
  });
});

describe('isCalendarDate', () => {
  it('accepts real calendar dates (incl. leap day)', () => {
    for (const d of ['2025-07-16', '2024-02-29', '2025-01-01', '2025-12-31']) {
      expect(isCalendarDate(d)).toBe(true);
    }
  });
  it('rejects impossible days that Date.parse would silently roll over', () => {
    for (const d of [
      '2025-02-30',
      '2025-06-31',
      '2025-04-31',
      '2025-02-29', // 2025 is not a leap year
      '2025-13-45',
      '2025-00-10',
      '2025-01-00',
    ]) {
      expect(isCalendarDate(d)).toBe(false);
    }
  });
  it('rejects malformed strings', () => {
    for (const d of ['2025-7-16', 'not-a-date', '20250716', '2025/07/16']) {
      expect(isCalendarDate(d)).toBe(false);
    }
  });
});

describe('slugFromDate', () => {
  it('derives a month-year slug', () => {
    expect(slugFromDate('2025-07-16')).toBe('jul-2025');
    expect(slugFromDate('2025-01-05')).toBe('jan-2025');
  });
});
