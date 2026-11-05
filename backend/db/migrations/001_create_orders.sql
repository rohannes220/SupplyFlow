-- Orders: domestic customer orders (50 states, DC, US territories) placed against a vendor.
CREATE TABLE IF NOT EXISTS orders (
  order_id       SERIAL PRIMARY KEY,
  -- TODO(#4): add REFERENCES vendors(vendor_id) once the vendors table exists.
  vendor_id      INTEGER        NOT NULL CHECK (vendor_id > 0),
  order_amount   NUMERIC(12, 2) NOT NULL CHECK (order_amount > 0),
  customer_name  VARCHAR(100)   NOT NULL CHECK (length(trim(customer_name)) > 0),
  customer_city  VARCHAR(100)   NOT NULL CHECK (length(trim(customer_city)) > 0),
  customer_state CHAR(2)        NOT NULL CHECK (customer_state IN (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS',
    'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC',
    'ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    -- US territories
    'AS','GU','MP','PR','VI'
  )),
  customer_phone CHAR(10)       NOT NULL CHECK (customer_phone ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  status         VARCHAR(20)    NOT NULL DEFAULT 'Draft'
                 CHECK (status IN ('Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled')),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders (vendor_id);
