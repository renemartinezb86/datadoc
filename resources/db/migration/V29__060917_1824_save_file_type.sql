ALTER TABLE abstract_file ADD COLUMN entity_type VARCHAR(255);

UPDATE abstract_file af
SET entity_type =
CASE
WHEN af.discr = 'Datadoc'
  THEN 'Datadoc'
WHEN af.discr = 'Folder'
  THEN 'Folder'
ELSE (
  SELECT d.format_name
  FROM File f
    INNER JOIN descriptor d ON f.descriptor = d.id
  WHERE f.id = af.id)
END;

ALTER TABLE descriptor DROP COLUMN "format_name";
