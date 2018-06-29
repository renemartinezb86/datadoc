alter table "user" add column admin BOOLEAN;
UPDATE "user" set admin = true;

