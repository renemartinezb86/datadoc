ALTER TABLE db_query_descriptor ADD COLUMN new_query BOOLEAN;
UPDATE db_query_descriptor SET new_query = FALSE;