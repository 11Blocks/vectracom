-- mission_field_reports: Optimax / SAV columns vs field-report.entity.ts
ALTER TABLE mission_field_reports ADD COLUMN IF NOT EXISTS sav_action text;
ALTER TABLE mission_field_reports ADD COLUMN IF NOT EXISTS sav_outcome text;
