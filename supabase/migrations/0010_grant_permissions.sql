-- OutputLab 0010 — Grant permissions pada schema public untuk role authenticated
-- Mengatasi error: "permission denied for table learning_items" (dan tabel lainnya)
-- yang terjadi bila default privileges Postgres tidak otomatis memberi akses ke role authenticated.
-- Aman dijalankan ulang (idempotent).

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;
