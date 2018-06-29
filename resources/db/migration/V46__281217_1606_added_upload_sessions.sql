CREATE TABLE public.upload_session
(
  id uuid NOT NULL,
  created timestamp without time zone,
  key character varying(255),
  "user" bigint,
  CONSTRAINT upload_session_pkey PRIMARY KEY (id),
  CONSTRAINT "FKq57abcwfl47xt1558cdiddkcd" FOREIGN KEY ("user")
  REFERENCES public."user" (id) MATCH SIMPLE
  ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
OIDS=FALSE
);