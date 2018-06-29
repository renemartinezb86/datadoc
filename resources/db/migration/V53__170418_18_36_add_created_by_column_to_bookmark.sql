ALTER TABLE table_bookmark
  ADD COLUMN created_by_user bigint,
  ADD FOREIGN KEY (created_by_user) REFERENCES "user" (id);