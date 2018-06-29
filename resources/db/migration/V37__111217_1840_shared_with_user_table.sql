create table if not exists user_file_share
(
  share_type integer,
  datadoc_id bigint not null
  constraint FKt5oxhs8s56cnlmjvxp8k4ijgn
  references datadoc,
  user_id bigint not null
  constraint FKwm2cff3h5huvhy5priapwfyt
  references "user",
  constraint shared_with_user_pkey
  primary key (datadoc_id, user_id)
)
;

