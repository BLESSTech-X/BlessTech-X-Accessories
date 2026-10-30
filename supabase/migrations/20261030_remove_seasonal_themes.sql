-- Retire the PhoneYa2 seasonal theme/campaign feature.
-- Keeps phoneya2_site_settings intact because it may store unrelated settings.
delete from public.phoneya2_site_settings
where setting_key = 'seasonal_theme';

drop table if exists public.seasonal_campaigns;
