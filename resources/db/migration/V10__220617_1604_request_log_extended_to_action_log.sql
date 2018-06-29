DROP TABLE request_log;
CREATE TABLE public.bookmark_action_log
(
  type character varying(3) NOT NULL,
  id bigint NOT NULL,
  bookmark_id bigint,
  datadoc_id bigint,
  start_time timestamp without time zone,
  duration bigint,
  storage_type integer,
  success boolean NOT NULL,
  table_id bigint,
  user_id bigint,

  bytes_processed bigint,
  facet_query boolean,
  from_cache boolean,
  query text,

  ingest_task_id character varying(64),
  rows_ingested bigint,
  account_id character varying(64),
  external_id character varying(64),
  CONSTRAINT bookmark_action_log_entry_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);