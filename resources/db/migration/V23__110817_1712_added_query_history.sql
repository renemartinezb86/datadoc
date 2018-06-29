CREATE TABLE public.db_query_history_item
(
  id bigint NOT NULL,
  duration bigint NOT NULL,
  query character varying(255),
  start_time timestamp without time zone,
  success boolean NOT NULL,
  descriptor bigint NOT NULL,
  CONSTRAINT db_query_history_item_pkey PRIMARY KEY (id),
  CONSTRAINT "FKkpyybedjt4di0oc2vjs04ey0v" FOREIGN KEY (descriptor)
  REFERENCES public.db_descriptor (id) MATCH SIMPLE
  ON UPDATE NO ACTION ON DELETE NO ACTION
)