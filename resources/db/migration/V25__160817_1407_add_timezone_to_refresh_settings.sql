ALTER TABLE refresh_settings ADD COLUMN time_zone VARCHAR(32);
ALTER TABLE refresh_settings ALTER COLUMN cron_expression DROP NOT NULL;