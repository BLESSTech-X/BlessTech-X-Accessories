-- PhoneYa2 checkout idempotency migration.
-- Review the existing orders/order_items schema and take a database backup before running.
-- Run this in Supabase SQL Editor BEFORE deploying the matching orders API and checkout page.
-- Existing orders are preserved; historical rows keep NULL idempotency values.
-- This prevents duplicate retries; it does NOT yet reserve/decrement catalogue stock.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '' CHECK (char_length(customer_note) <= 1000);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
  ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_phoneya2_order(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_request_fingerprint TEXT,
  p_customer_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_existing_total NUMERIC(12,2);
  v_existing_fingerprint TEXT;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_slug TEXT;
  v_title TEXT;
  v_qty INTEGER;
  v_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_item_count INTEGER := 0;
  v_customer_note TEXT := trim(coalesce(p_customer_note, ''));
BEGIN
  IF p_idempotency_key IS NULL OR p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~* '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid order request fingerprint';
  END IF;

  -- Serialize simultaneous submissions that share the same request key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  -- A matching retry returns the original order before checking current catalogue values.
  SELECT o.id, o.order_number, o.total_amount, o.request_fingerprint
    INTO v_order_id, v_order_number, v_existing_total, v_existing_fingerprint
  FROM public.orders AS o
  WHERE o.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'Idempotency key was already used for different order details';
    END IF;
    RETURN jsonb_build_object(
      'id', v_order_id, 'order_number', v_order_number, 'total_amount', v_existing_total,
      'currency', 'ZMW', 'replayed', true
    );
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) < 2 OR length(p_customer_name) > 120 THEN
    RAISE EXCEPTION 'Invalid customer name';
  END IF;
  IF length(trim(coalesce(p_customer_email, ''))) < 3 OR length(p_customer_email) > 254
     OR p_customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid customer email';
  END IF;
  IF length(trim(coalesce(p_customer_phone, ''))) < 7 OR length(p_customer_phone) > 40 THEN
    RAISE EXCEPTION 'Invalid customer phone';
  END IF;
  IF length(trim(coalesce(p_delivery_address, ''))) < 5 OR length(p_delivery_address) > 500 THEN
    RAISE EXCEPTION 'Invalid delivery address';
  END IF;
  IF char_length(v_customer_note) > 1000 THEN
    RAISE EXCEPTION 'Order note must be 1000 characters or fewer';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 30 product lines';
  END IF;

  -- Validate all item snapshots before inserting any data.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_slug := v_item->>'product_slug';
    v_title := v_item->>'product_name';
    v_qty := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := (v_item->>'line_total')::NUMERIC;

    IF v_slug IS NULL OR length(v_slug) < 1 OR length(v_slug) > 101
       OR v_slug IN ('.', '..')
       OR position('/' in v_slug) > 0 OR position(chr(92) in v_slug) > 0
       OR position('?' in v_slug) > 0 OR position('#' in v_slug) > 0 OR v_slug ~ '[[:cntrl:]]'
       OR v_title IS NULL OR length(v_title) < 1 OR length(v_title) > 200
       OR v_qty IS NULL OR v_qty < 1 OR v_qty > 99
       OR v_price IS NULL OR v_price < 0
       OR v_line_total IS NULL OR v_line_total <> round(v_price * v_qty, 2) THEN
      RAISE EXCEPTION 'Invalid order item';
    END IF;

    v_item_count := v_item_count + 1;
    v_total := v_total + v_line_total;
  END LOOP;

  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address, customer_note,
    idempotency_key, request_fingerprint, status, total_amount, currency
  ) VALUES (
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    trim(p_delivery_address), v_customer_note, p_idempotency_key, p_request_fingerprint,
    'pending', v_total, 'ZMW'
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_slug, product_name, quantity, unit_price, line_total
    ) VALUES (
      v_order_id, v_item->>'product_slug', v_item->>'product_name',
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price')::NUMERIC,
      (v_item->>'line_total')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total,
    'currency', 'ZMW', 'item_count', v_item_count, 'replayed', false
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO service_role;
