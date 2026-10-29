-- PostgreSQL repetition bounds cannot exceed 255. Keep URL length limits
-- outside the regex; retain HTTPS-only validation and reject whitespace.
alter table public.sc_pdc_sources drop constraint sc_pdc_sources_source_url_check;
alter table public.sc_pdc_sources add constraint sc_pdc_sources_source_url_check
 check (source_url ~ '^https://[^[:space:]]{5,}$' and length(source_url) between 13 and 1008);
alter table public.sc_pdc_trials drop constraint sc_pdc_trials_photo_url_check;
alter table public.sc_pdc_trials add constraint sc_pdc_trials_photo_url_check
 check (photo_url is null or (photo_url ~ '^https://[^[:space:]]{5,}$' and length(photo_url) between 13 and 1008));
