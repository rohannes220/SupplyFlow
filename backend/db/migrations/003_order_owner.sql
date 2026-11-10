-- Existing orders have no known owner and can only be managed by administrators.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
