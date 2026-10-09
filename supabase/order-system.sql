-- PhoneYa2 order transaction function.
-- Run this in Supabase SQL Editor AFTER the orders and order_items tables exist.
-- The browser must never call this with a service-role key. Only the server endpoint does.
-- This function calculates totals from the server-validated item snapshots and inserts
-- the order and all order items atomically in one PostgreSQL transaction.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '' CHECK (char_length(customer_note) <= 1000);
DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_phoneya2_order(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address TEXT,
  p_items JSONB,
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
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_slug TEXT;
  v_title TEXT;
  v_qty INTEGER;
  v_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_stock INTEGER;
  v_item_count INTEGER := 0;
  v_customer_note TEXT := trim(coalesce(p_customer_note, ''));
BEGIN
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
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Order items must be an array';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 30 product lines';
  END IF;

  -- Validate all supplied item snapshots before inserting any data.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_slug := v_item->>'product_slug';
    v_title := v_item->>'product_name';
    v_qty := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := (v_item->>'line_total')::NUMERIC;

    IF v_slug IS NULL OR v_slug !~ '^[a-z0-9][a-z0-9-]{0,100}$'
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
    status, total_amount, currency
  ) VALUES (
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    trim(p_delivery_address), v_customer_note, 'pending', v_total, 'ZMW'
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_slug, product_name, quantity, unit_price, line_total
    ) VALUES (
      v_order_id,
      v_item->>'product_slug',
      v_item->>'product_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'line_total')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total,
    'currency', 'ZMW',
    'item_count', v_item_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
