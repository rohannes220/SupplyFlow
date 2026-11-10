CREATE TABLE IF NOT EXISTS admin_identities (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  email VARCHAR(255) NOT NULL UNIQUE
);

DO $$
DECLARE
  first_email TEXT := lower(trim(current_setting('supplyflow.admin_email_1', true)));
  second_email TEXT := lower(trim(current_setting('supplyflow.admin_email_2', true)));
  count_identities INTEGER;
BEGIN
  LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE admin_identities IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO count_identities FROM admin_identities;
  IF count_identities = 0 THEN
    IF first_email IS NULL OR first_email = '' OR second_email IS NULL OR second_email = ''
       OR first_email = second_email THEN
      RAISE EXCEPTION 'Configure two distinct verified administrator emails before applying this migration';
    END IF;
    INSERT INTO admin_identities (user_id, email)
      SELECT id, email FROM users WHERE email IN (first_email, second_email);
    IF (SELECT count(*) FROM admin_identities) <> 2 THEN
      RAISE EXCEPTION 'Both designated administrator accounts must already exist';
    END IF;
  ELSIF count_identities <> 2 THEN
    RAISE EXCEPTION 'Administrator identities are incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM users u WHERE u.role = 'admin'
      AND NOT EXISTS (SELECT 1 FROM admin_identities a WHERE a.user_id = u.id)
  ) THEN
    RAISE EXCEPTION 'An existing administrator is not one of the designated accounts';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_admin_identity_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Administrator identities cannot be changed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_admin_identities ON admin_identities;
CREATE TRIGGER lock_admin_identities BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON admin_identities FOR EACH STATEMENT EXECUTE FUNCTION prevent_admin_identity_change();

CREATE OR REPLACE FUNCTION enforce_fixed_administrators() RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM admin_identities WHERE user_id = NEW.id AND email = NEW.email
  ) THEN
    RAISE EXCEPTION 'Only designated accounts can be administrators' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email AND EXISTS (
    SELECT 1 FROM admin_identities WHERE user_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'The email of a designated administrator cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_fixed_administrators ON users;
CREATE TRIGGER enforce_fixed_administrators BEFORE INSERT OR UPDATE OF role, email ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_fixed_administrators();
