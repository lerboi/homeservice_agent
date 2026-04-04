-- Migration 035: Add email to leads and title to invoices
-- Email: collected manually by owner after initial call (not from AI)
-- Title: friendly invoice name alongside auto-generated invoice_number

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title text;
