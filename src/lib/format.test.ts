import { describe, expect, it } from 'vitest';
import { safeCsvCell, number, money, date } from './format';
describe('Safe exports and absent data', () => {
  it('neutralizes formulas in exported customer-controlled values', () => { expect(safeCsvCell('=HYPERLINK("https://bad.example")')).toBe('"\'=HYPERLINK(""https://bad.example"")"'); expect(safeCsvCell('+cmd')).toBe('"\'+cmd"'); });
  it('does not represent withheld metrics as zero', () => { expect(number(null)).toBe('—'); expect(number(undefined)).toBe('—'); expect(money(undefined)).toBe('—'); expect(number(0)).toBe('0'); });
  it('handles malformed or absent timestamps without breaking tables', () => { expect(date('not-a-date')).toBe('—'); expect(date(null)).toBe('—'); });
});
