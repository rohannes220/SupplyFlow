# Sample data

Sample vendors and orders for development and testing.

| File                                              | Rows | Description                                        |
| ------------------------------------------------- | ---- | -------------------------------------------------- |
| `vendors.csv`                                     | 140  | Vendor ID (1–140), name, city, state, phone, email |
| `orders.csv`                                      | 140  | Order ID, amount, vendor ID, customer details      |
| `us_vendors_orders_realistic_business_names.xlsx` | —    | Source workbook with both sheets                   |

- Every `Vendor ID` in `orders.csv` matches a vendor in `vendors.csv`.
- All addresses and phone numbers are in the US (no international orders).
- Vendor emails use the pattern `<company name>orders@gmail.com`, shortened to fit
  Gmail's 30-character limit. Some of these addresses may belong to real people,
  so do not send email to them.
- Orders have either a business name (`Customer Type` = Business) or a first and
  last name (`Customer Type` = Consumer).
