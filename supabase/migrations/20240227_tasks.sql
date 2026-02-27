-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  done boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  done_at timestamptz
);

-- Disable RLS for single-user mode (same as saved_content)
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
