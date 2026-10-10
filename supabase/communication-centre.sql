-- PhoneYa2 Smart Communications: Phase 1 foundation
-- Run once in Supabase SQL Editor before deploying the matching Cloudflare Pages code.
-- All access is server-side through the service-role key. Do not expose that key in the browser.

CREATE TABLE IF NOT EXISTS public.email_activity (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  event_type TEXT NOT NULL DEFAULT 'transactional',
  source TEXT NOT NULL DEFAULT 'automatic' CHECK (source IN ('automatic','manual')),
  trigger_source TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('queued','sent','delivered','bounced','failed')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  related_order_number TEXT NOT NULL DEFAULT '',
  related_product_slug TEXT NOT NULL DEFAULT '',
  campaign_id UUID,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS email_activity_created_at_idx ON public.email_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS email_activity_recipient_idx ON public.email_activity (lower(recipient_email));
CREATE INDEX IF NOT EXISTS email_activity_status_idx ON public.email_activity (status);
CREATE INDEX IF NOT EXISTS email_activity_type_idx ON public.email_activity (event_type);

CREATE TABLE IF NOT EXISTS public.customer_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','subscribed','unsubscribed','bounced')),
  consent_source TEXT NOT NULL DEFAULT '',
  preferences JSONB NOT NULL DEFAULT '{"new_arrivals":true,"offers":true,"tips":true}'::jsonb,
  consented_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_subscribers_status_idx ON public.customer_subscribers (status);

CREATE TABLE IF NOT EXISTS public.communication_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.communication_automations (automation_key,name,description,enabled,approval_required,config)
VALUES
 ('customer_order_confirmation','Customer order confirmation','Send a transactional email after an order is saved.',true,false,'{"type":"transactional"}'::jsonb),
 ('new_product_announcement','New-product announcements','Prepare announcements when new products are published.',false,true,'{"audience":"subscribers","deduplicate":true}'::jsonb),
 ('back_in_stock','Back-in-stock alerts','Notify subscribers who requested a product availability alert.',false,true,'{"audience":"product_watchers"}'::jsonb),
 ('customer_follow_up','Customer follow-ups','Schedule relevant post-purchase communications.',false,true,'{"frequency_cap_days":14}'::jsonb)
ON CONFLICT (automation_key) DO NOTHING;

ALTER TABLE public.email_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automations ENABLE ROW LEVEL SECURITY;
-- Intentionally no anon/authenticated policies: only the server's service-role key can access these tables.

CREATE OR REPLACE FUNCTION public.phoneya2_email_stats()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'automatic', count(*) FILTER (WHERE source = 'automatic'),
    'manual', count(*) FILTER (WHERE source = 'manual'),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'delivered', count(*) FILTER (WHERE status = 'delivered'),
    'bounced', count(*) FILTER (WHERE status = 'bounced'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'queued', count(*) FILTER (WHERE status = 'queued'),
    'last_30_days', count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
    'failed_last_30_days', count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '30 days')
  )
  FROM public.email_activity;
$$;
REVOKE ALL ON FUNCTION public.phoneya2_email_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phoneya2_email_stats() TO service_role;


-- Phase 2: explicit opt-in confirmation and resumable manual campaigns.
ALTER TABLE public.customer_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token UUID,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS customer_subscribers_confirmation_token_idx
  ON public.customer_subscribers (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','failed')),
  audience TEXT NOT NULL DEFAULT 'subscribed' CHECK (audience IN ('subscribed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS email_campaigns_created_at_idx ON public.email_campaigns (created_at DESC);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
-- No browser access; the server uses the service-role key after administrator authentication.


-- Phase 3: product-publish announcement queue. The automation remains disabled by default.
CREATE TABLE IF NOT EXISTS public.product_announcement_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL UNIQUE,
  product_title TEXT NOT NULL,
  product_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','disabled','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS product_announcement_jobs_status_idx ON public.product_announcement_jobs (status, created_at DESC);
ALTER TABLE public.product_announcement_jobs ENABLE ROW LEVEL SECURITY;
