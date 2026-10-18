-- Normalize LATAM country codes on existing job inventory.
-- Idempotent data cleanup for ATS feeds that expose city/country in free-form location text.

UPDATE public.jobs
SET country = CASE
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'argentina|buenos aires' THEN 'ar'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'brazil|brasil|são paulo|sao paulo|rio de janeiro' THEN 'br'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'mexico|méxico' THEN 'mx'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'colombia|bogotá|bogota|medellín|medellin' THEN 'co'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'chile' THEN 'cl'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'peru|perú|lima' THEN 'pe'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'uruguay|montevideo' THEN 'uy'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'ecuador|quito|guayaquil' THEN 'ec'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'paraguay|asunción|asuncion' THEN 'py'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'bolivia' THEN 'bo'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'costa rica' THEN 'cr'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'panama|panamá' THEN 'pa'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'guatemala' THEN 'gt'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'honduras' THEN 'hn'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'el salvador' THEN 'sv'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'nicaragua' THEN 'ni'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'dominican republic|república dominicana|republica dominicana' THEN 'do'
  WHEN lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~ 'puerto rico' THEN 'pr'
  ELSE country
END
WHERE lower(coalesce(country,'') || ' ' || coalesce(location,'')) ~
'argentina|buenos aires|brazil|brasil|são paulo|sao paulo|rio de janeiro|mexico|méxico|colombia|bogotá|bogota|medellín|medellin|chile|peru|perú|lima|uruguay|montevideo|ecuador|quito|guayaquil|paraguay|asunción|asuncion|bolivia|costa rica|panama|panamá|guatemala|honduras|el salvador|nicaragua|dominican republic|república dominicana|republica dominicana|puerto rico';
