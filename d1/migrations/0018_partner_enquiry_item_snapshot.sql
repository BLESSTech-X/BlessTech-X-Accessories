-- Preserve the exact catalogue item context attached to each enquiry.
-- This keeps the title, image and price visible even if the partner later edits or removes the item.
ALTER TABLE partner_enquiries ADD COLUMN catalog_item_title TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_enquiries ADD COLUMN catalog_item_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_enquiries ADD COLUMN catalog_item_price_label TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_enquiries ADD COLUMN catalog_item_type TEXT NOT NULL DEFAULT '';
