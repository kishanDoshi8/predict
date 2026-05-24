create function private.generate_token()
returns text
language sql
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;
