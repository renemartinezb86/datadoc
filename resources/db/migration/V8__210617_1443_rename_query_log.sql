ALTER TABLE big_query_request_log RENAME TO request_log;
ALTER TABLE request_log ADD COLUMN success boolean;
ALTER TABLE request_log ADD COLUMN execution_time INTEGER;