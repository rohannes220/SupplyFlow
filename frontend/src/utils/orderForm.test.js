import { describe, it, expect } from 'vitest';
import { EMPTY_ORDER_FORM, formToOrderInput, errorsByField } from './orderForm.js';

describe('formToOrderInput', () => {
  it('converts numeric text fields to numbers and leaves the rest as typed', () => {
    expect(
      formToOrderInput({
        vendorId: ' 3 ',
        orderAmount: '$1,250.50',
        customerName: 'Sarah Chen',
        customerCity: 'Atlanta',
        customerState: 'GA',
        customerPhone: '(404) 555-0123',
      }),
    ).toEqual({
      vendorId: 3,
      orderAmount: 1250.5,
      customerName: 'Sarah Chen',
      customerCity: 'Atlanta',
      customerState: 'GA',
      customerPhone: '(404) 555-0123',
    });
  });

  it('keeps blank and non-numeric values so validation can report them', () => {
    const input = formToOrderInput({ ...EMPTY_ORDER_FORM, vendorId: 'abc', orderAmount: '1.2.3' });
    expect(input.vendorId).toBe('abc');
    expect(input.orderAmount).toBe('1.2.3');
    expect(formToOrderInput(EMPTY_ORDER_FORM).vendorId).toBe('');
  });
});

describe('errorsByField', () => {
  it('maps the first message for each field', () => {
    expect(
      errorsByField([
        { field: 'vendorId', message: 'first' },
        { field: 'vendorId', message: 'second' },
        { field: 'customerCity', message: 'city' },
      ]),
    ).toEqual({ vendorId: 'first', customerCity: 'city' });
  });
});
