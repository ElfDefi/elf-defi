import { Directive, HostListener, Input } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import BigNumber from 'bignumber.js';
import { BIG_NUMBER_FORMAT } from '../../constants/formats/BIG_NUMBER_FORMAT';

@Directive({
  selector: '[appNumberPrecision]',
  providers: [
    {
      provide: NG_VALIDATORS,
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      useExisting: NumberPrecisionDirective,
      multi: true
    }
  ]
})
export class NumberPrecisionDirective implements Validator {
  // eslint-disable-next-line no-magic-numbers
  @Input() integerLength? = 32; // 32 is default length of integer part of token's amount

  // eslint-disable-next-line no-magic-numbers
  @Input() decimalLength = 8; // 8 is default length of decimal part of token's amount

  @Input() minValue: string;

  @Input() maxValue: string;

  /**
   * The element, which this directive is working on.
   */
  @Input() inputElement: HTMLInputElement;

  private readonly decimalNumberRegex = /^[0-9]+\.?[0-9]*$/;

  private lastValue: string = '';

  private lastCursorPosition: number;

  constructor() {}

  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      this.lastValue = '';
      this.lastCursorPosition = 0;
      return null;
    }

    const value = control.value.split(',').join('');

    if (value === this.lastValue.split(',').join('')) {
      if (control.value !== this.lastValue) {
        this.setLastValidValue(control);
      }
      return this.checkOverflow(value);
    }

    if (!value.match(this.decimalNumberRegex)) {
      this.setLastValidValue(control);
      return this.checkOverflow(this.lastValue);
    }

    const [integerPart, fractionalPart] = value.split('.');
    if (
      integerPart.length > this.integerLength ||
      (fractionalPart && fractionalPart.length > this.decimalLength)
    ) {
      this.setLastValidValue(control);
      return this.checkOverflow(this.lastValue);
    }

    this.setNewValue(control, value);
    return this.checkOverflow(value);
  }

  private setLastValidValue(control: AbstractControl) {
    control.setValue(this.lastValue);
    this.inputElement.setSelectionRange(this.lastCursorPosition, this.lastCursorPosition);
  }

  private checkOverflow(value: string) {
    value = value.split(',').join('');
    if (this.minValue && new BigNumber(value).isLessThan(this.minValue)) {
      return { overflowMinValue: true };
    }
    if (this.maxValue && new BigNumber(value).isGreaterThan(this.maxValue)) {
      return { overflowMaxValue: true };
    }
    return null;
  }

  private setNewValue(control: AbstractControl, value: string): void {
    const newValue = new BigNumber(value).toFormat(BIG_NUMBER_FORMAT);

    const cursorPosition = this.inputElement.selectionStart;

    const isSymbolAdded = this.lastValue.length < newValue.length;
    const commasAmountBeforeCursorPosition =
      this.lastValue.substring(0, cursorPosition - (isSymbolAdded ? 1 : 0)).split(',').length - 1;
    const newCommasAmountBeforeCursorPosition =
      newValue.substring(0, cursorPosition).split(',').length - 1;

    let newCursorPosition =
      cursorPosition + (newCommasAmountBeforeCursorPosition - commasAmountBeforeCursorPosition);
    if (newCursorPosition && newValue.length && newValue[newCursorPosition - 1] === ',') {
      newCursorPosition--;
    }

    this.lastValue = newValue + (value[value.length - 1] === '.' ? '.' : '');
    control.setValue(this.lastValue);
    this.inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
    this.lastCursorPosition = newCursorPosition;
  }

  @HostListener('keyup')
  @HostListener('click')
  onCursorChange() {
    this.lastCursorPosition = this.inputElement.selectionStart;
  }
}
