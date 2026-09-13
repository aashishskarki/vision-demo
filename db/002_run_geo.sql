-- Vision Demo — migration 002: per-run search geography
--
-- Each run now targets a country the visitor picks on the setup page, which
-- drives DataForSEO's location_name and web-search country code. Nullable;
-- the pipeline falls back to the DATAFORSEO_LOCATION/COUNTRY env defaults.

alter table demo_runs add column if not exists location text;
alter table demo_runs add column if not exists country_iso text;
