alter table format_settings add column charset varchar(255);
update format_settings set charset = 'UTF-8' where discr = 'CsvFormatSettings';