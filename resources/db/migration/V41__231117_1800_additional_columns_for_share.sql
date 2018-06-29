alter table user_file_share
add constraint FKrew88u20oh4n71l0nb0rwgclx
foreign key (owner) references "user";

alter table user_file_share
  add constraint FK1cxq4q492epthfp6bjtu4r0h5
foreign key (share_from) references "user";