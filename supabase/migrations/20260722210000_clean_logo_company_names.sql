-- One-off cleanup: strip LinkedIn logo alt text from company names already saved.
--
-- Rows added before the parser learned to drop this text stored names like
-- "Company logo for, Regeneron". Fixing the parser only cleans text on the way
-- in, so existing rows need this backfill.
--
-- Run the SELECT first and read what it proposes. Only run the UPDATE if the
-- "after" column looks right for every row.

-- ---------------------------------------------------------------- 1. preview

with cleaned as (
  select
    id,
    company as before,
    case
      -- Checked first, mirroring stripLogoNoise in src/lib/parsePosting.ts.
      -- Without this, "Company logo" falls through to the trailing-logo rule
      -- and becomes "Company" — a plausible-looking name that is simply wrong.
      when btrim(company) ~* '^(company\s+)?logo$' then ''
      else btrim(
        regexp_replace(
          regexp_replace(company, '^(company\s+)?logo\s+for[,:]?\s*', '', 'i'),
          '\s+logo$', '', 'i'
        )
      )
    end as after
  from public.applications
)
select id, before, after
from cleaned
where after <> before
order by before;

-- Names that are ONLY alt text ("Company logo") lost the employer entirely
-- before it was ever saved — there is nothing to recover, so the update below
-- skips them. This lists them so they can be corrected by hand.
select id, company, position
from public.applications
where btrim(company) ~* '^(company\s+)?logo$';

-- ----------------------------------------------------------------- 2. update

with cleaned as (
  select
    id,
    company as before,
    case
      -- Checked first, mirroring stripLogoNoise in src/lib/parsePosting.ts.
      -- Without this, "Company logo" falls through to the trailing-logo rule
      -- and becomes "Company" — a plausible-looking name that is simply wrong.
      when btrim(company) ~* '^(company\s+)?logo$' then ''
      else btrim(
        regexp_replace(
          regexp_replace(company, '^(company\s+)?logo\s+for[,:]?\s*', '', 'i'),
          '\s+logo$', '', 'i'
        )
      )
    end as after
  from public.applications
)
update public.applications a
set company = c.after
from cleaned c
where a.id = c.id
  and c.after <> c.before
  -- Never blank a name: better a wrong one that can be edited than an empty one.
  and c.after <> '';
