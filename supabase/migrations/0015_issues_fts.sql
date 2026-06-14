-- Migration to add FTS column, index, and RPC for searching and ranking
ALTER TABLE issues ADD COLUMN fts tsvector 
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_excerpt, ''))) STORED;

CREATE INDEX issues_fts_idx ON issues USING GIN(fts);

-- Function to allow PostgREST to search issues and sort by ts_rank
CREATE OR REPLACE FUNCTION search_issues(search_query text)
RETURNS SETOF issues
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM issues
  WHERE fts @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(fts, plainto_tsquery('english', search_query)) DESC;
$$;
