-- Vendors that orders are placed against. Vendors are deactivated (status = 'Inactive'),
-- never deleted. Field rules mirror shared/vendorRules.js.
CREATE TABLE IF NOT EXISTS vendors (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  -- Stored lowercase so uniqueness ignores case.
  email      VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%_@_%._%'),
  phone      CHAR(10)     NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  city       VARCHAR(100) NOT NULL CHECK (length(trim(city)) > 0),
  state      CHAR(2)      NOT NULL CHECK (state IN (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS',
    'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC',
    'ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    -- US territories
    'AS','GU','MP','PR','VI'
  )),
  status     VARCHAR(10)  NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors (status);
