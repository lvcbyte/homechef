-- Receipt OCR Enhancements Migration
-- Adds functions and improvements for receipt parsing

-- ============================================
-- 1. ENHANCE RECEIPT_UPLOADS TABLE
-- ============================================
-- Add columns if they don't exist
alter table public.receipt_uploads 
  add column if not exists items_detected jsonb default '[]'::jsonb,
  add column if not exists total_amount numeric(10,2),
  add column if not exists store_name text,
  add column if not exists purchase_date date,
  add column if not exists ocr_confidence real,
  add column if not exists processing_error text;

-- Add index for faster queries
create index if not exists idx_receipt_uploads_user_status 
  on public.receipt_uploads(user_id, status);

-- ============================================
-- 2. RECEIPT PARSING FUNCTION
-- ============================================
create or replace function parse_receipt_items(
  p_receipt_text text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_lines text[];
  v_line text;
  v_item jsonb;
  v_price_pattern text := '(\d+[,\.]\d{2})';
  v_quantity_pattern text := '(\d+)\s*(x|×|stuks?|st\.?|kg|g|liter|l|ml)';
  v_item_name text;
  v_price numeric;
  v_quantity text;
begin
  -- Split text into lines
  v_lines := string_to_array(p_receipt_text, E'\n');
  
  -- Process each line
  foreach v_line in array v_lines loop
    -- Skip empty lines and header/footer lines
    if length(trim(v_line)) < 3 then
      continue;
    end if;
    
    -- Skip common receipt headers/footers
    if v_line ~* '(totaal|total|bedrag|subtotaal|btw|vat|korting|discount|bon|receipt|datum|date|kassier|cashier)' then
      continue;
    end if;
    
    -- Try to extract price (usually at end of line)
    if v_line ~ v_price_pattern then
      -- Extract price
      v_price := (regexp_match(v_line, v_price_pattern))[1]::numeric;
      
      -- Remove price from line to get item name
      v_item_name := regexp_replace(v_line, v_price_pattern, '', 'g');
      v_item_name := trim(regexp_replace(v_item_name, '\s+', ' ', 'g'));
      
      -- Try to extract quantity
      if v_item_name ~ v_quantity_pattern then
        v_quantity := (regexp_match(v_item_name, v_quantity_pattern))[1];
        v_item_name := regexp_replace(v_item_name, v_quantity_pattern, '', 'g');
        v_item_name := trim(v_item_name);
      else
        v_quantity := '1';
      end if;
      
      -- Only add if we have a meaningful item name (at least 2 characters)
      if length(v_item_name) >= 2 then
        v_item := jsonb_build_object(
          'name', v_item_name,
          'quantity', v_quantity,
          'price', v_price,
          'confidence', 0.7
        );
        v_items := v_items || jsonb_build_array(v_item);
      end if;
    end if;
  end loop;
  
  return v_items;
end;
$$;

-- ============================================
-- 3. FUNCTION TO MATCH RECEIPT ITEMS TO CATALOG
-- ============================================
create or replace function match_receipt_items_to_inventory(
  p_receipt_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
as $$
declare
  v_receipt record;
  v_items jsonb;
  v_item jsonb;
  v_matched_count integer := 0;
  v_catalog_match record;
  v_inventory_item_id uuid;
begin
  -- Get receipt data
  select * into v_receipt
  from public.receipt_uploads
  where id = p_receipt_id
    and user_id = p_user_id;
  
  if not found then
    return 0;
  end if;
  
  -- Get parsed items
  v_items := coalesce(v_receipt.items_detected, '[]'::jsonb);
  
  -- Process each item
  for v_item in select * from jsonb_array_elements(v_items) loop
    -- Try to match with product catalog
    select * into v_catalog_match
    from public.product_catalog
    where match_product_catalog((v_item->>'name')) is not null
    limit 1;
    
    -- If matched, add to inventory
    if found then
      -- Detect category
      perform detect_category((v_item->>'name'));
      
      -- Estimate expiry
      perform estimate_expiry_date(
        (select category from detect_category((v_item->>'name')) limit 1)
      );
      
      -- Insert into inventory
      insert into public.inventory (
        user_id,
        name,
        category,
        quantity_approx,
        catalog_product_id,
        catalog_price,
        confidence_score
      )
      values (
        p_user_id,
        v_item->>'name',
        (select category from detect_category((v_item->>'name')) limit 1)::text,
        v_item->>'quantity',
        v_catalog_match.id,
        (v_item->>'price')::numeric,
        0.8
      )
      returning id into v_inventory_item_id;
      
      v_matched_count := v_matched_count + 1;
    end if;
  end loop;
  
  -- Update receipt status
  update public.receipt_uploads
  set status = 'completed',
      parsed_payload = jsonb_build_object(
        'items_matched', v_matched_count,
        'items_total', jsonb_array_length(v_items)
      )
  where id = p_receipt_id;
  
  return v_matched_count;
end;
$$;

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
grant execute on function parse_receipt_items(text, uuid) to authenticated;
grant execute on function match_receipt_items_to_inventory(uuid, uuid) to authenticated;

