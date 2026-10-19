-- PhoneYa2 customer note + idempotent order function.
-- For an existing production database, review and use supabase/order-idempotency-migration.sql first.
-- Existing orders are preserved; historical rows keep a NULL idempotency_key.
-- This protects against duplicate retry submissions; it does not yet reserve/decrement stock.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '' CHECK (char_length(customer_note) <= 1000);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT);


CREATE OR REPLACE FUNCTION public.create_phoneya2_order(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
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
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_slug TEXT;
  v_title TEXT;
  v_qty INTEGER;
  v_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_item_count INTEGER := 0;
  v_customer_note TEXT := trim(coalesce(p_customer_note, ''));
  v_existing_name TEXT;
  v_existing_email TEXT;
  v_existing_phone TEXT;
  v_existing_address TEXT;
  v_existing_note TEXT;
  v_existing_items JSONB;
  v_requested_items JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid idempotency key';
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

  -- Serialize requests sharing the same key, including simultaneous retries.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

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

  SELECT jsonb_agg(jsonb_build_object(
    'product_slug', x.value->>'product_slug',
    'product_name', x.value->>'product_name',
    'quantity', (x.value->>'quantity')::INTEGER,
    'unit_price', (x.value->>'unit_price')::NUMERIC,
    'line_total', (x.value->>'line_total')::NUMERIC
  ) ORDER BY x.value->>'product_slug')
  INTO v_requested_items
  FROM jsonb_array_elements(p_items) AS x(value);

  SELECT o.id, o.order_number, o.total_amount, o.customer_name, o.customer_email,
         o.customer_phone, o.delivery_address, o.customer_note
    INTO v_order_id, v_order_number, v_existing_total, v_existing_name, v_existing_email,
         v_existing_phone, v_existing_address, v_existing_note
  FROM public.orders AS o
  WHERE o.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    SELECT jsonb_agg(jsonb_build_object(
      'product_slug', oi.product_slug,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'line_total', oi.line_total
    ) ORDER BY oi.product_slug)
    INTO v_existing_items
    FROM public.order_items AS oi
    WHERE oi.order_id = v_order_id;

    IF v_existing_name IS DISTINCT FROM trim(p_customer_name)
       OR v_existing_email IS DISTINCT FROM lower(trim(p_customer_email))
       OR v_existing_phone IS DISTINCT FROM trim(p_customer_phone)
       OR v_existing_address IS DISTINCT FROM trim(p_delivery_address)
       OR coalesce(v_existing_note, '') IS DISTINCT FROM v_customer_note
       OR v_existing_total IS DISTINCT FROM v_total
       OR v_existing_items IS DISTINCT FROM v_requested_items THEN
      RAISE EXCEPTION 'Idempotency key was already used for different order details';
    END IF;

    RETURN jsonb_build_object(
      'id', v_order_id, 'order_number', v_order_number, 'total_amount', v_existing_total,
      'currency', 'ZMW', 'item_count', v_item_count, 'replayed', true
    );
  END IF;

  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address, customer_note,
    idempotency_key, status, total_amount, currency
  ) VALUES (
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    trim(p_delivery_address), v_customer_note, p_idempotency_key, 'pending', v_total, 'ZMW'
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
REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
