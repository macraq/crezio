update public.profiles
set account_type = 'admin'
where id = (
  select id from auth.users where email = 'admin@crezio.app'
);