alter table type_descriptor add column integer boolean;
update type_descriptor set discr = 'n' where data_type in (0, 1);
update type_descriptor set integer = false where data_type = 1;
update type_descriptor set data_type = 1, integer = true where data_type = 0;