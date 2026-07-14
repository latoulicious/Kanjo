-- +goose Up
-- Sync identity + LWW clock: client_uuid keys device rows to server rows,
-- updated_at arbitrates last-write-wins (see internal/syncer).
ALTER TABLE accounts     ADD COLUMN client_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                         ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE categories   ADD COLUMN client_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                         ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE projects     ADD COLUMN client_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                         ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE transactions ADD COLUMN client_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                         ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recurring    ADD COLUMN client_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                         ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Web CRUD never sets updated_at; the trigger stamps it unless the writer
-- (sync upsert) already changed it explicitly.
-- +goose StatementBegin
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  IF NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER accounts_touch     BEFORE UPDATE ON accounts     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER categories_touch   BEFORE UPDATE ON categories   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER projects_touch     BEFORE UPDATE ON projects     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER transactions_touch BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER recurring_touch    BEFORE UPDATE ON recurring    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- +goose Down
DROP TRIGGER accounts_touch ON accounts;
DROP TRIGGER categories_touch ON categories;
DROP TRIGGER projects_touch ON projects;
DROP TRIGGER transactions_touch ON transactions;
DROP TRIGGER recurring_touch ON recurring;
DROP FUNCTION touch_updated_at();
ALTER TABLE accounts     DROP COLUMN client_uuid, DROP COLUMN updated_at;
ALTER TABLE categories   DROP COLUMN client_uuid, DROP COLUMN updated_at;
ALTER TABLE projects     DROP COLUMN client_uuid, DROP COLUMN updated_at;
ALTER TABLE transactions DROP COLUMN client_uuid, DROP COLUMN updated_at;
ALTER TABLE recurring    DROP COLUMN client_uuid, DROP COLUMN updated_at;
