ALTER table table_bookmark drop column current_state ;
ALTER table table_bookmark add column default_state uuid;