export { formatUsPhone } from '@supplyflow/shared/usLocations';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCurrency(amount) {
  return currency.format(amount);
}
