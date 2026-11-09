-- Users who can log in. Passwords are stored only as bcrypt hashes.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  email         VARCHAR(255) NOT NULL UNIQUE CHECK (length(trim(email)) > 0),
  password_hash TEXT         NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'employee')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
