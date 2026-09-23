import Decimal from 'decimal.js-light';

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const underHundred = (n: number): string =>
  n < 20 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 === 0 ? '' : ' ' + UNITS[n % 10]);

const underHundredOrHundred = (n: number): string =>
  n < 100 ? underHundred(n) : underHundred(Math.floor(n / 100)) + ' hundred' + (n % 100 === 0 ? '' : ' ' + underHundred(n % 100));

/**
 * Indian-system amount in words (crore / lakh / thousand), matching the desktop
 * app's AmountWords.ToIndianWords: paise are dropped, not rounded.
 */
export function toIndianWords(amount: number | string): string {
  const value = new Decimal(String(amount));
  // Truncate like C# decimal.Truncate; decimal.js-light's toInteger() would round.
  let rest = value.abs().toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
  if (rest === 0) return 'zero rupees';
  const parts: string[] = [];
  for (const [divisor, scale] of [[10_000_000, 'crore'], [100_000, 'lakh'], [1_000, 'thousand'], [100, 'hundred']] as const) {
    const n = Math.floor(rest / divisor);
    if (n > 0) parts.push(underHundredOrHundred(n) + ' ' + scale);
    rest %= divisor;
  }
  if (rest > 0) parts.push(underHundred(rest));
  return (value.isNegative() ? 'minus ' : '') + parts.join(' ') + ' rupees';
}
