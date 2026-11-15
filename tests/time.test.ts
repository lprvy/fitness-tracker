import { formatSeconds } from '../src/utils/time';

describe('formatSeconds', () => {
  it.each([
    [0, '00:00'],
    [9, '00:09'],
    [60, '01:00'],
    [90, '01:30'],
    [120, '02:00'],
    [605, '10:05'],
  ])('%i seconds -> %s', (input, expected) => {
    expect(formatSeconds(input)).toBe(expected);
  });

  it('never shows negative time', () => {
    expect(formatSeconds(-5)).toBe('00:00');
  });
});
