-- OmniFlow migration 005 — source nickname (short_name).
--
-- Adds an optional `short_name` column to public.sources so the user can pick
-- a compact label for each institution ("BTG" instead of "BTG Pactual").
-- Dashboard and table surfaces fall back to `name` when null.

alter table public.sources add column short_name text;
