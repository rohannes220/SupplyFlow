# Sample data

Sample vendors and orders for development and testing.

| File                                              | Rows | Description                                        |
| ------------------------------------------------- | ---- | -------------------------------------------------- |
| `vendors.csv`                                     | 140  | Vendor ID (1–140), name, city, state, phone, email |
| `orders.csv`                                      | 140  | Order ID, amount, vendor ID, customer details, status |
| `us_vendors_orders_realistic_business_names.xlsx` | —    | Source workbook with both sheets                      |

- Every `Vendor ID` in `orders.csv` matches a vendor in `vendors.csv`.
- All addresses and phone numbers are in the US (no international orders).
- Vendor emails use the pattern `<company name>orders@example.com`, using the
  reserved `.example` domain so they cannot reach real people.
- Orders have either a business name (`Customer Type` = Business) or a first and
  last name (`Customer Type` = Consumer).
- Orders include a `Status` column with values aligned to the application lifecycle
  (`Pending`, `Shipped`, `Delivered`).
