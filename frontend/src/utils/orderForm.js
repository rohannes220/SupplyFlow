export const EMPTY_ORDER_FORM = Object.freeze({
  vendorId: '',
  orderAmount: '',
  customerName: '',
  customerCity: '',
  customerState: '',
  customerPhone: '',
});

function toNumberIfNumeric(text, pattern) {
  return pattern.test(text) ? Number(text) : text;
}

/** Converts raw form text into the API payload; validation decides what is acceptable. */
export function formToOrderInput(form) {
  return {
    vendorId: toNumberIfNumeric(form.vendorId.trim(), /^\d+$/),
    orderAmount: toNumberIfNumeric(
      form.orderAmount.trim().replace(/^\$/, '').replace(/,/g, ''),
      /^\d+(\.\d+)?$|^\.\d+$/,
    ),
    customerName: form.customerName,
    customerCity: form.customerCity,
    customerState: form.customerState,
    customerPhone: form.customerPhone,
  };
}

/** [{ field, message }] -> { field: message }, keeping the first message per field. */
export function errorsByField(errors) {
  const map = {};
  for (const { field, message } of errors) map[field] ??= message;
  return map;
}
