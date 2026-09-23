import DecimalBase from 'decimal.js-light';
import { toIndianWords } from './amountWords';
import { daysBetween } from './dates';
import type { AuditCalculation, CalculationInput } from './types';

// Decimal arithmetic so results match the desktop app's C# `decimal` exactly.
const Decimal = DecimalBase.clone({ precision: 34 });
type Dec = InstanceType<typeof Decimal>;

const ZERO = new Decimal(0);
const dec = (value: number | undefined): Dec =>
  new Decimal(typeof value === 'number' && Number.isFinite(value) ? String(value) : 0);
const nonNegative = (value: Dec): Dec => (value.isNegative() ? ZERO : value);
const roundNearest = (value: Dec): Dec => value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
const roundTwo = (value: Dec): Dec => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const max = (a: Dec, b: Dec): Dec => (a.greaterThan(b) ? a : b);

/**
 * Deduction rules for a contractor bill. This is a line-for-line port of the
 * desktop app's AuditCalculator; golden tests in calculator.test.ts compare it
 * against the compiled C# output.
 */
export function calculate(input: CalculationInput): AuditCalculation {
  const pac = nonNegative(dec(input.pac));
  let baseAmount = nonNegative(dec(input.baseAmount));
  let billAmount = nonNegative(dec(input.billAmount));
  const electricityCharges = nonNegative(dec(input.electricityCharges));
  const isFinal = input.partFinal === 'Final';
  const fineWaived = input.fine === 'Yes';

  // Either amount can be derived from the other using 18% GST.
  if (baseAmount.lessThanOrEqualTo(0) && billAmount.greaterThan(0)) baseAmount = roundTwo(billAmount.dividedBy('1.18'));
  if (billAmount.lessThanOrEqualTo(0) && baseAmount.greaterThan(0)) billAmount = roundTwo(baseAmount.times('1.18'));

  const bv = max(ZERO, baseAmount.minus(pac));
  const days = daysBetween(input.documentDate, input.actualDocumentDate);
  const delay = daysBetween(input.workOrderDate, input.agreementDate);
  const gst = baseAmount.greaterThan(250000) ? roundNearest(baseAmount.times('0.02')) : ZERO;
  const incomeTax = roundNearest(baseAmount.times(input.personCompany === 'Company' ? '0.02' : '0.01'));
  const wwc = roundNearest(baseAmount.times('0.01'));
  const wwcCollectionCharge = roundNearest(wwc.times('0.01'));
  const wwcCessToBoard = wwc.minus(wwcCollectionCharge);
  const retention = input.partFinal === 'Part' ? roundNearest(baseAmount.times('0.025')) : ZERO;

  // Completion delay: 1% of PAC per full week late, plus 1% for a part week.
  let fine = ZERO;
  if (days > 0 && isFinal) fine = pac.times('0.01').times(Math.floor(days / 7));
  if (days % 7 > 0) fine = fine.plus(pac.times('0.01'));
  if (fine.greaterThan(pac.times('0.1'))) fine = new Decimal(100000);
  if (fineWaived) fine = ZERO;
  fine = roundNearest(fine);

  // Agreement executed more than 14 days after the work order: 1% of PAC, minimum 1000.
  let agreementFine = delay > 14 && isFinal ? pac.times('0.01') : ZERO;
  if (agreementFine.greaterThan(0) && agreementFine.lessThan(1000)) agreementFine = new Decimal(1000);
  if (fineWaived) agreementFine = ZERO;
  agreementFine = roundNearest(agreementFine);

  const totalDeductions = retention.plus(agreementFine).plus(fine).plus(gst).plus(wwc).plus(electricityCharges).plus(incomeTax);
  const netPayable = roundNearest(billAmount.minus(totalDeductions));

  return {
    pac: pac.toNumber(),
    ba: baseAmount.toNumber(),
    billAmount: roundNearest(billAmount).toNumber(),
    baseAmount: baseAmount.toNumber(),
    bv: bv.toNumber(),
    nlc: isFinal ? 'Yes' : 'Part Bill',
    days,
    delay,
    gst: gst.toNumber(),
    it: incomeTax.toNumber(),
    wwc: wwc.toNumber(),
    wwcCollectionCharge: wwcCollectionCharge.toNumber(),
    wwcCessToBoard: wwcCessToBoard.toNumber(),
    retention: retention.toNumber(),
    fine: fine.toNumber(),
    fineagr: agreementFine.toNumber(),
    dwoit: totalDeductions.toNumber(),
    wit: netPayable.toNumber(),
    eh: incomeTax.plus(netPayable).toNumber(),
    cheque: netPayable.toNumber(),
    billAmountInWords: toIndianWords(billAmount.toString()),
    netPayableInWords: toIndianWords(netPayable.toString()),
  };
}

/** Rounds to whole rupees, halves away from zero (C# MidpointRounding.AwayFromZero). */
export function roundRupees(value: number): number {
  return roundNearest(dec(value)).toNumber();
}

/** GST at 18% of the base value, as pre-filled on the bill form. */
export function gstAt18Percent(baseAmount: number): number {
  return roundTwo(nonNegative(dec(baseAmount)).times('0.18')).toNumber();
}
