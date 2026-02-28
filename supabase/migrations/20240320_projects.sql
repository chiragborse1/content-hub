-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Going To Work On',
  github_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Disable RLS for single-user mode to match saved_content and tasks
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
