alter table bookmark_action_log
  add column show_me_query text,
  add column billable_user_id bigint,
  add column cost bigint;