ALTER TABLE type_descriptor ADD COLUMN possible_millis_timestamp BOOLEAN;
UPDATE type_descriptor SET possible_millis_timestamp = FALSE WHERE discr = 'n';