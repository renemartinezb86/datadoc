-- remove individual root folders, store docs and sources in common root folder
update abstract_file set parent = null where parent in (-1, -2);

delete from folder where id in (-1, -2);
delete from abstract_file where id in (-1, -2);

