-- Add explicit marker for transferred KPI rows
-- Add explicit marker for transferred KPI rows
-- Use `IF NOT EXISTS` variants where supported (MySQL 8+). If your server is older,
-- this migration may be a no-op or need a DB-specific compatibility change.
-- Attempt to add the column; if it already exists the migration runner will skip/ignore the error
ALTER TABLE chain_kpis ADD COLUMN transfer_source_kpi_id INT NULL AFTER department_id;

-- Optional index for filtering by transferred KPI marker
CREATE INDEX idx_chain_kpis_transfer_source ON chain_kpis (transfer_source_kpi_id);

-- Backfill existing transferred KPIs from old description marker if present
UPDATE chain_kpis
SET transfer_source_kpi_id = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(description, '#', -1), ')', 1) AS UNSIGNED)
WHERE transfer_source_kpi_id IS NULL
  AND description LIKE '%(Điều phối từ KPI #%';
