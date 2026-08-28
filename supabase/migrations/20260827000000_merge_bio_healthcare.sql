-- Merge the "Healthcare" and "Biotech / Pharma" industries into one
-- "Bio / Healthcare". industry is free text on applications, so this is just a
-- relabel of the rows that used either of the old names.

update public.applications
set industry = 'Bio / Healthcare'
where industry in ('Healthcare', 'Biotech / Pharma');
