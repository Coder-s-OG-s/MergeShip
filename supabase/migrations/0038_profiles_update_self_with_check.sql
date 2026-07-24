drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
