CREATE TABLE public.closed_notes
(
  entity_id bigint NOT NULL,
  note integer
)
WITH (
OIDS=FALSE
);

ALTER TABLE "user"
 ADD COLUMN created timestamp without time zone,
 ADD COLUMN deleted boolean NOT NULL DEFAULT FALSE,
 ADD COLUMN updated timestamp without time zone;