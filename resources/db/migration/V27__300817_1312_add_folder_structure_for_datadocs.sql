insert into abstract_file
(
  discr, id, created, deleted, updated, annotation, name, "user", parent
)
select
  'Datadoc', id, created, deleted, updated, null, name, "user", null
from datadoc;

alter table datadoc
  drop column created,
  drop column deleted,
  drop column updated,
  drop column "name",
  drop column "user";

-- insert 2 ROOT folders -> for Sources and Datadocs
insert into abstract_file (id, discr, name, deleted) values (-2, 'Folder', 'Datadocs', false);
insert into abstract_file (id, discr, name, deleted) values (-1, 'Folder', 'Sources', false);

insert into folder (id) values (-1);
insert into folder (id) values (-2);

-- assign existing files and datadocs to created ROOT folders
update abstract_file set parent = -1 where parent is null and discr <> 'Datadoc' and id not in (-1, -2);
update abstract_file set parent = -2 where parent is null and discr = 'Datadoc' and id not in (-1, -2);