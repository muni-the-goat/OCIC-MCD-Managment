-- Rename the terminal positive status from "approved" to "reviewed".
-- Run this once in the Supabase SQL editor if you already ran 0001_init.sql.
-- (Fresh setups run 0001 then this file in order — both converge to "reviewed".)
--
-- RENAME VALUE keeps the same underlying enum member, so existing rows and RLS
-- policies that referenced 'approved' keep working — they now mean 'reviewed'.

alter type public.report_status rename value 'approved' to 'reviewed';
