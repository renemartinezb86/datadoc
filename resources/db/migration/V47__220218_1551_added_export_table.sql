create table export_entity
(
  result_file_id uuid not null
  constraint export_entity_pkey
  primary key,
  export_date timestamp,
  removed boolean,
  datadoc bigint
  constraint FKo6o6443siql0vy25exwblfxb0
  references datadoc
)
;