CREATE TABLE public.datadoc
(
  id bigint NOT NULL,
  created timestamp without time zone,
  updated timestamp without time zone,
  "name" character varying(255),
  tab_counter bigint NOT NULL,
  "user" bigint,
  deleted boolean DEFAULT false,
  table_schema bigint,
  CONSTRAINT datadoc_pkey PRIMARY KEY (id),
  CONSTRAINT "datadoc_user" FOREIGN KEY ("user")
      REFERENCES public."user" (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.datadoc_entity_operation
(
  datadoc_id bigint NOT NULL,
  entity_operation_id bigint NOT NULL,
  CONSTRAINT "FKkqrda71igfyqbcxneaiw7x6f5" FOREIGN KEY (entity_operation_id)
      REFERENCES public.entity_operation (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FKl3juxvkwytxethgds7n5s5c3f" FOREIGN KEY (datadoc_id)
      REFERENCES public.datadoc (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT uk_buojf5ml9gj7x7eedel3d1sx7 UNIQUE (entity_operation_id)
)
WITH (
  OIDS=FALSE
);

insert into datadoc (id, created,  updated, "name", tab_counter, "user", deleted, table_schema)
select nextval('hibernate_sequence'), created, updated, "name", tab_counter, "user", deleted, id
from table_schema
where tab_counter > 0;


alter table table_bookmark add column datadoc bigint;
update table_bookmark tb set datadoc = (select id from datadoc d where d.table_schema = tb.table_schema);
alter table table_bookmark alter column datadoc set not null;

alter table datadoc drop column table_schema;
alter table table_schema 
drop column created,
drop column updated,
drop column "name",
drop column tab_counter,
drop column preview_image;