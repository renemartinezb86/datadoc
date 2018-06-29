ALTER TABLE type_descriptor ADD COLUMN no_time BOOLEAN;
UPDATE type_descriptor SET no_time = FALSE WHERE discr = 'd';