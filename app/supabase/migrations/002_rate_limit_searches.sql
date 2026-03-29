-- Phase 1: Add rate limiting to artist_searches insert policy
-- Limits anonymous/authenticated users to 60 searches per hour
-- Run this AFTER 001_initial_schema.sql

-- Drop the original unrestricted insert policy
DROP POLICY "searches_insert_own" ON public.artist_searches;

-- Replace with rate-limited version: 60 searches per hour per user
-- Also enforces server-controlled timestamps to prevent backdating bypass
CREATE POLICY "searches_insert_rate_limited" ON public.artist_searches
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND searched_at >= now() - interval '1 minute'
    AND (
      SELECT count(*) FROM public.artist_searches
      WHERE user_id = auth.uid()
      AND searched_at > now() - interval '1 hour'
    ) < 60
  );
