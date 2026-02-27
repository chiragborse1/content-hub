-- Single-user mode: disable RLS so the app works without authentication.
-- All data is private by nature since this is a personal local tool.
ALTER TABLE public.saved_content DISABLE ROW LEVEL SECURITY;
