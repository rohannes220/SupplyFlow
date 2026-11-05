import { describe, it, expect } from 'vitest';
import { validateOrderInput } from '../../services/orderService.js';
import { ValidationError } from '../../utils/errors.js';
import { validOrderBody } from '../helpers/inMemoryOrderModel.js';

function errorsFor(body) {
  try {
    validateOrderInput(body);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    return err.details;
  }
  throw new Error('expected validateOrderInput to throw');
}

function fieldsWithErrors(body) {
  return errorsFor(body).map((d) => d.field);
}

describe('validateOrderInput', () => {
  it('accepts and normalizes a valid domestic order', () => {
    expect(validateOrderInput({ ...validOrderBody, customerName: '  Sarah Chen ' })).toEqual({
      vendorId: 3,
      orderAmount: 2250.5,
      customerName: 'Sarah Chen',
      customerCity: 'Atlanta',
      customerState: 'GA',
      customerPhone: '4045550123',
    });
  });

  it('rejects a non-object body', () => {
    expect(fieldsWithErrors(null)).toEqual(['body']);
    expect(fieldsWithErrors([])).toEqual(['body']);
    expect(fieldsWithErrors('order')).toEqual(['body']);
  });

  it('reports every missing required field', () => {
    expect(fieldsWithErrors({}).sort()).toEqual(
      [
        'customerCity',
        'customerName',
        'customerPhone',
        'customerState',
        'orderAmount',
        'vendorId',
      ].sort(),
    );
  });

  it('rejects unknown fields, including client-supplied orderId and status', () => {
    expect(fieldsWithErrors({ ...validOrderBody, orderId: 9 })).toEqual(['orderId']);
    expect(fieldsWithErrors({ ...validOrderBody, status: 'Delivered' })).toEqual(['status']);
  });

  describe('vendorId', () => {
    it.each([0, -1, 1.5, '3', null, true, Number.MAX_SAFE_INTEGER + 1])(
      'rejects %s',
      (vendorId) => {
        expect(fieldsWithErrors({ ...validOrderBody, vendorId })).toEqual(['vendorId']);
      },
    );
  });

  describe('orderAmount', () => {
    it.each([0, -10, 10.555, '100', NaN, Infinity, 10_000_000_000, null])(
      'rejects %s',
      (orderAmount) => {
        expect(fieldsWithErrors({ ...validOrderBody, orderAmount })).toEqual(['orderAmount']);
      },
    );

    it.each([0.01, 19.9, 100, 9_999_999_999.99])('accepts %s', (orderAmount) => {
      expect(validateOrderInput({ ...validOrderBody, orderAmount }).orderAmount).toBe(orderAmount);
    });
  });

  describe('customerName', () => {
    it.each(['', '   ', 'a'.repeat(101), 42, 'Robert; DROP TABLE orders', 'J0hn'])(
      'rejects %j',
      (customerName) => {
        expect(fieldsWithErrors({ ...validOrderBody, customerName })).toEqual(['customerName']);
      },
    );

    it.each(["Mary O'Neil", 'Jean-Luc Picard', 'J. R. Smith'])('accepts %j', (customerName) => {
      expect(validateOrderInput({ ...validOrderBody, customerName }).customerName).toBe(
        customerName,
      );
    });
  });

  describe('customerCity', () => {
    it.each(['', 'a'.repeat(101), 7, 'Paris<script>'])('rejects %j', (customerCity) => {
      expect(fieldsWithErrors({ ...validOrderBody, customerCity })).toEqual(['customerCity']);
    });

    it.each(['St. Louis', "Coeur d'Alene", 'Winston-Salem'])('accepts %j', (customerCity) => {
      expect(validateOrderInput({ ...validOrderBody, customerCity }).customerCity).toBe(
        customerCity,
      );
    });
  });

  describe('customerState (no international orders)', () => {
    it.each([
      ['ga', 'GA'],
      ['DC', 'DC'],
      ['New York', 'NY'],
      ['  north carolina ', 'NC'],
    ])('normalizes %j to %s', (customerState, expected) => {
      expect(validateOrderInput({ ...validOrderBody, customerState }).customerState).toBe(expected);
    });

    it.each(['ON', 'Ontario', 'XX', 'England', '', 12])('rejects %j', (customerState) => {
      expect(fieldsWithErrors({ ...validOrderBody, customerState })).toEqual(['customerState']);
    });
  });

  describe('customerPhone (no international orders)', () => {
    it.each([
      ['404-555-0123', '4045550123'],
      ['(404) 555-0123', '4045550123'],
      ['404.555.0123', '4045550123'],
      ['+1 404 555 0123', '4045550123'],
      ['1-404-555-0123', '4045550123'],
    ])('normalizes %j', (customerPhone, expected) => {
      expect(validateOrderInput({ ...validOrderBody, customerPhone }).customerPhone).toBe(expected);
    });

    it.each([
      '+44 20 7946 0958',
      '555-0123',
      '040-555-0123',
      '404-155-0123',
      '404555012345',
      'call me',
      4045550123,
    ])('rejects %j', (customerPhone) => {
      expect(fieldsWithErrors({ ...validOrderBody, customerPhone })).toEqual(['customerPhone']);
    });
  });

  describe('customerCountry', () => {
    it.each(['US', 'usa', 'United States'])(
      'allows %j and does not store it',
      (customerCountry) => {
        expect(validateOrderInput({ ...validOrderBody, customerCountry })).not.toHaveProperty(
          'customerCountry',
        );
      },
    );

    it.each(['CA', 'Mexico', 'UK'])('rejects international country %j', (customerCountry) => {
      const details = errorsFor({ ...validOrderBody, customerCountry });
      expect(details).toEqual([
        { field: 'customerCountry', message: expect.stringMatching(/international/i) },
      ]);
    });
  });
});
