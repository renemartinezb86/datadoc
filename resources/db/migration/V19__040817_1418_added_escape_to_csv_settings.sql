ALTER TABLE format_settings ADD COLUMN escape CHAR;
UPDATE format_settings SET escape = '\' where discr = 'CsvFormatSettings';