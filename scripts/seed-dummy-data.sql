-- ============================================================
-- Voco Dummy Data Seed Script
-- Tenant: 3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18
-- Run against your Supabase SQL Editor
-- ============================================================

-- Use a transaction so we can roll back if anything goes wrong
BEGIN;

-- ============================================================
-- 0. VARIABLES
-- ============================================================
-- Tenant ID constant used throughout
DO $$ BEGIN RAISE NOTICE 'Seeding data for tenant 3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18'; END $$;

-- ============================================================
-- 1. SERVICES (6 services for a plumbing + HVAC business)
-- ============================================================
INSERT INTO services (id, tenant_id, name, urgency_tag, is_active, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Burst Pipe Repair',       'emergency',   true, 0),
  ('a0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Water Heater Install',    'high_ticket',  true, 1),
  ('a0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Drain Cleaning',          'routine',      true, 2),
  ('a0000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'AC Unit Replacement',     'high_ticket',  true, 3),
  ('a0000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Toilet Repair',           'routine',      true, 4),
  ('a0000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Gas Leak Detection',      'emergency',    true, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. SERVICE ZONES (3 zones)
-- ============================================================
INSERT INTO service_zones (id, tenant_id, name, postal_codes) VALUES
  ('b0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Downtown',     ARRAY['10001','10002','10003','10004','10005']),
  ('b0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Midtown',      ARRAY['10016','10017','10018','10019','10020']),
  ('b0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 'Upper East',   ARRAY['10021','10028','10065','10075','10128'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. ZONE TRAVEL BUFFERS
-- ============================================================
INSERT INTO zone_travel_buffers (id, tenant_id, zone_a_id, zone_b_id, buffer_mins) VALUES
  ('c0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'b0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 20),
  ('c0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'b0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000003', 25),
  ('c0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'b0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000003', 35)
ON CONFLICT (zone_a_id, zone_b_id) DO NOTHING;

-- ============================================================
-- 4. ESCALATION CONTACTS (3 contacts)
-- ============================================================
INSERT INTO escalation_contacts (id, tenant_id, name, role, phone, email, notification_pref, timeout_seconds, sort_order, is_active) VALUES
  ('d0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Mike Johnson', 'Owner', '+15551234567', 'mike@example.com', 'both', 30, 0, true),
  ('d0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Sarah Chen', 'Office Manager', '+15559876543', 'sarah@example.com', 'sms', 45, 1, true),
  ('d0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Dave Wilson', 'Senior Tech', '+15555551234', 'dave@example.com', 'email', 60, 2, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. INVOICE SETTINGS
-- ============================================================
INSERT INTO invoice_settings (tenant_id, business_name, address, phone, email, tax_rate, payment_terms, default_notes, invoice_prefix, estimate_prefix, late_fee_enabled, late_fee_type, late_fee_amount) VALUES
  ('3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Premier Plumbing & HVAC', '123 Main Street, New York, NY 10001', '+15551234567',
   'billing@premierplumbing.com', 0.0875, 'Net 30',
   'Thank you for choosing Premier Plumbing & HVAC!', 'INV', 'EST',
   true, 'flat', 25.00)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================
-- 6. CALLS (20 calls over the past 3 weeks)
-- ============================================================
INSERT INTO calls (id, tenant_id, call_id, from_number, to_number, direction, status, start_timestamp, end_timestamp, transcript_text, detected_language, urgency_classification, urgency_confidence, triage_layer_used, booking_outcome, notification_priority, recovery_sms_status, created_at) VALUES

-- Call 1: Emergency burst pipe - booked (3 weeks ago)
('e0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_001', '+15551110001', '+15551234567', 'inbound', 'analyzed',
 1741737600, 1741737900,
 'Caller: Hi, I have water flooding my basement right now! The pipe burst under the kitchen sink. Agent: I understand this is an emergency. Let me get you scheduled right away.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '21 days'),

-- Call 2: Routine drain cleaning - booked (3 weeks ago)
('e0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_002', '+15551110002', '+15551234567', 'inbound', 'analyzed',
 1741824000, 1741824240,
 'Caller: My kitchen drain has been slow for about a week now. Agent: I can help schedule a drain cleaning for you.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '20 days'),

-- Call 3: Water heater install quote - declined booking (2.5 weeks ago)
('e0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_003', '+15551110003', '+15551234567', 'inbound', 'analyzed',
 1741910400, 1741910760,
 'Caller: I need a quote for a new tankless water heater installation. Agent: I can schedule an assessment. Caller: Actually, I will call back after I compare some prices.',
 'en', 'high_ticket', 'medium', 'layer2', 'declined', 'standard', 'sent',
 NOW() - INTERVAL '18 days'),

-- Call 4: Emergency gas smell - booked (2 weeks ago)
('e0000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_004', '+15551110004', '+15551234567', 'inbound', 'analyzed',
 1742169600, 1742169840,
 'Caller: I smell gas in my kitchen near the stove. Agent: This sounds like it could be urgent. Let me get a technician out immediately.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '14 days'),

-- Call 5: Toilet repair - booked (2 weeks ago)
('e0000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_005', '+15551110005', '+15551234567', 'inbound', 'analyzed',
 1742256000, 1742256180,
 'Caller: My toilet keeps running and won''t stop. Agent: I can get that fixed for you. Let me find an available slot.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '13 days'),

-- Call 6: AC replacement inquiry - not attempted (12 days ago)
('e0000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_006', '+15551110006', '+15551234567', 'inbound', 'analyzed',
 1742342400, 1742342520,
 'Caller: My AC unit is 15 years old and I think it needs replacing. I am just calling around for estimates right now.',
 'en', 'high_ticket', 'high', 'layer2', 'not_attempted', 'standard', 'sent',
 NOW() - INTERVAL '12 days'),

-- Call 7: Repeat caller - drain issue follow-up - booked (11 days ago)
('e0000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_007', '+15551110002', '+15551234567', 'inbound', 'analyzed',
 1742428800, 1742429020,
 'Caller: Hi, I called before about my drain. It is still clogged after the last visit. Agent: I see your previous appointment. Let me schedule a follow-up.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '11 days'),

-- Call 8: Spanish speaker - routine (10 days ago)
('e0000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_008', '+15551110007', '+15551234567', 'inbound', 'analyzed',
 1742515200, 1742515500,
 'Caller: Hola, tengo un problema con mi calentador de agua. No sale agua caliente. Agent: Entiendo. Puedo programar una cita para revisar su calentador.',
 'es', 'routine', 'medium', 'layer2', 'booked', 'standard', null,
 NOW() - INTERVAL '10 days'),

-- Call 9: Emergency no heat - booked (9 days ago)
('e0000001-0000-0000-0000-000000000009', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_009', '+15551110008', '+15551234567', 'inbound', 'analyzed',
 1742601600, 1742601840,
 'Caller: We have no heat and it is freezing. There are kids in the house. Agent: I understand the urgency. Let me get someone out to you as soon as possible.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '9 days'),

-- Call 10: Faucet replacement - booked (8 days ago)
('e0000001-0000-0000-0000-000000000010', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_010', '+15551110009', '+15551234567', 'inbound', 'analyzed',
 1742688000, 1742688300,
 'Caller: I need a kitchen faucet replaced. The old one is leaking at the base. Agent: Sure, let me find a time that works for you.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '8 days'),

-- Call 11: Sewer backup emergency - booked (7 days ago)
('e0000001-0000-0000-0000-000000000011', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_011', '+15551110010', '+15551234567', 'inbound', 'analyzed',
 1742774400, 1742774700,
 'Caller: There is sewage backing up into my bathtub. It smells terrible. Agent: That is definitely an emergency. Let me get someone there right away.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '7 days'),

-- Call 12: Routine quote request - declined (6 days ago)
('e0000001-0000-0000-0000-000000000012', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_012', '+15551110011', '+15551234567', 'inbound', 'analyzed',
 1742860800, 1742860980,
 'Caller: I just need a ballpark price for re-piping my bathroom. Agent: I can schedule a free assessment. Caller: No thanks, just a rough number is fine for now.',
 'en', 'high_ticket', 'medium', 'layer2', 'declined', 'standard', 'sent',
 NOW() - INTERVAL '6 days'),

-- Call 13: Garbage disposal install - booked (5 days ago)
('e0000001-0000-0000-0000-000000000013', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_013', '+15551110012', '+15551234567', 'inbound', 'analyzed',
 1742947200, 1742947440,
 'Caller: I bought a new garbage disposal and need someone to install it. Agent: Great, we can definitely help with that.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '5 days'),

-- Call 14: Whole-house water filtration - not attempted (4 days ago)
('e0000001-0000-0000-0000-000000000014', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_014', '+15551110013', '+15551234567', 'inbound', 'analyzed',
 1743033600, 1743033720,
 'Caller: I am interested in a whole-house water filtration system. Just gathering information right now.',
 'en', 'high_ticket', 'high', 'layer2', 'not_attempted', 'standard', 'sent',
 NOW() - INTERVAL '4 days'),

-- Call 15: Leaking shower - booked (3 days ago)
('e0000001-0000-0000-0000-000000000015', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_015', '+15551110014', '+15551234567', 'inbound', 'analyzed',
 1743120000, 1743120300,
 'Caller: My shower head is leaking pretty badly even when turned off. Agent: I can schedule a repair for you this week.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '3 days'),

-- Call 16: Frozen pipes emergency - booked (2 days ago)
('e0000001-0000-0000-0000-000000000016', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_016', '+15551110015', '+15551234567', 'inbound', 'analyzed',
 1743206400, 1743206640,
 'Caller: I think my pipes froze overnight. No water is coming out of any faucet. Agent: That needs immediate attention before they burst.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '2 days'),

-- Call 17: Thermostat replacement - booked (yesterday)
('e0000001-0000-0000-0000-000000000017', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_017', '+15551110016', '+15551234567', 'inbound', 'analyzed',
 1743292800, 1743293040,
 'Caller: My thermostat stopped working and the display is blank. Agent: We can replace that for you. Let me check our schedule.',
 'en', 'routine', 'medium', 'layer2', 'booked', 'standard', null,
 NOW() - INTERVAL '1 day'),

-- Call 18: New caller today - booked
('e0000001-0000-0000-0000-000000000018', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_018', '+15551110017', '+15551234567', 'inbound', 'analyzed',
 1743379200, 1743379500,
 'Caller: I need a plumber to look at my main water line. The water pressure has dropped significantly. Agent: Let me schedule an inspection for you.',
 'en', 'routine', 'high', 'layer1', 'booked', 'standard', null,
 NOW() - INTERVAL '6 hours'),

-- Call 19: New caller today - declined
('e0000001-0000-0000-0000-000000000019', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_019', '+15551110018', '+15551234567', 'inbound', 'analyzed',
 1743382800, 1743382920,
 'Caller: How much do you charge for a basic plumbing inspection? Agent: I can schedule one for you. Caller: No, I am just price shopping right now.',
 'en', 'routine', 'high', 'layer1', 'declined', 'standard', null,
 NOW() - INTERVAL '3 hours'),

-- Call 20: New caller today - emergency, just came in
('e0000001-0000-0000-0000-000000000020', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'call_seed_020', '+15551110019', '+15551234567', 'inbound', 'analyzed',
 1743386400, 1743386640,
 'Caller: Water is spraying everywhere from the pipe under my bathroom sink! I cannot shut it off! Agent: Stay calm, I am booking the earliest available slot right now.',
 'en', 'emergency', 'high', 'layer1', 'booked', 'high', null,
 NOW() - INTERVAL '1 hour')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. APPOINTMENTS (14 appointments — past, today, future)
-- ============================================================
INSERT INTO appointments (id, tenant_id, call_id, start_time, end_time, service_address, postal_code, street_name, caller_name, caller_phone, urgency, zone_id, status, booked_via, notes, created_at) VALUES

-- Past appointments (completed)
('f0000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000001',
 NOW() - INTERVAL '20 days' + INTERVAL '9 hours', NOW() - INTERVAL '20 days' + INTERVAL '10 hours',
 '45 Broadway, Apt 3B, New York, NY 10004', '10004', 'Broadway',
 'Robert Martinez', '+15551110001', 'emergency',
 'b0000001-0000-0000-0000-000000000001', 'completed', 'ai_call', 'Burst pipe under kitchen sink', NOW() - INTERVAL '21 days'),

('f0000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000002',
 NOW() - INTERVAL '18 days' + INTERVAL '14 hours', NOW() - INTERVAL '18 days' + INTERVAL '15 hours',
 '220 E 23rd St, New York, NY 10010', '10016', 'E 23rd St',
 'Lisa Thompson', '+15551110002', 'routine',
 'b0000001-0000-0000-0000-000000000002', 'completed', 'ai_call', 'Slow kitchen drain', NOW() - INTERVAL '20 days'),

('f0000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000004',
 NOW() - INTERVAL '13 days' + INTERVAL '8 hours', NOW() - INTERVAL '13 days' + INTERVAL '9 hours',
 '89 Park Ave, Apt 12A, New York, NY 10016', '10016', 'Park Ave',
 'James Kim', '+15551110004', 'emergency',
 'b0000001-0000-0000-0000-000000000002', 'completed', 'ai_call', 'Gas smell near kitchen stove', NOW() - INTERVAL '14 days'),

('f0000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000005',
 NOW() - INTERVAL '11 days' + INTERVAL '11 hours', NOW() - INTERVAL '11 days' + INTERVAL '12 hours',
 '155 W 68th St, New York, NY 10023', '10021', 'W 68th St',
 'Angela Davis', '+15551110005', 'routine',
 'b0000001-0000-0000-0000-000000000003', 'completed', 'ai_call', 'Running toilet', NOW() - INTERVAL '13 days'),

('f0000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000009',
 NOW() - INTERVAL '8 days' + INTERVAL '8 hours', NOW() - INTERVAL '8 days' + INTERVAL '9 hours',
 '312 E 85th St, Apt 6C, New York, NY 10028', '10028', 'E 85th St',
 'Maria Gonzalez', '+15551110008', 'emergency',
 'b0000001-0000-0000-0000-000000000003', 'completed', 'ai_call', 'No heat, kids in house', NOW() - INTERVAL '9 days'),

('f0000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000010',
 NOW() - INTERVAL '6 days' + INTERVAL '13 hours', NOW() - INTERVAL '6 days' + INTERVAL '14 hours',
 '78 Lexington Ave, New York, NY 10016', '10016', 'Lexington Ave',
 'Tom Nguyen', '+15551110009', 'routine',
 'b0000001-0000-0000-0000-000000000002', 'completed', 'ai_call', 'Kitchen faucet leaking at base', NOW() - INTERVAL '8 days'),

('f0000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000011',
 NOW() - INTERVAL '6 days' + INTERVAL '9 hours', NOW() - INTERVAL '6 days' + INTERVAL '10 hours',
 '501 W Houston St, New York, NY 10002', '10002', 'W Houston St',
 'Karen Patel', '+15551110010', 'emergency',
 'b0000001-0000-0000-0000-000000000001', 'completed', 'ai_call', 'Sewer backup in bathtub', NOW() - INTERVAL '7 days'),

('f0000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000007',
 NOW() - INTERVAL '5 days' + INTERVAL '10 hours', NOW() - INTERVAL '5 days' + INTERVAL '11 hours',
 '220 E 23rd St, New York, NY 10010', '10016', 'E 23rd St',
 'Lisa Thompson', '+15551110002', 'routine',
 'b0000001-0000-0000-0000-000000000002', 'completed', 'ai_call', 'Follow-up drain cleaning', NOW() - INTERVAL '11 days'),

-- Today and upcoming appointments (confirmed)
('f0000001-0000-0000-0000-000000000009', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000013',
 NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours',
 '42 Spring St, Apt 2, New York, NY 10003', '10003', 'Spring St',
 'Derek Brown', '+15551110012', 'routine',
 'b0000001-0000-0000-0000-000000000001', 'confirmed', 'ai_call', 'Garbage disposal installation', NOW() - INTERVAL '5 days'),

('f0000001-0000-0000-0000-000000000010', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000015',
 NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '10 hours',
 '199 E 3rd St, New York, NY 10003', '10003', 'E 3rd St',
 'Nina Patel', '+15551110014', 'routine',
 'b0000001-0000-0000-0000-000000000001', 'confirmed', 'ai_call', 'Leaking shower head', NOW() - INTERVAL '3 days'),

('f0000001-0000-0000-0000-000000000011', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000016',
 NOW() + INTERVAL '1 day' + INTERVAL '14 hours', NOW() + INTERVAL '1 day' + INTERVAL '15 hours',
 '67 W 95th St, New York, NY 10025', '10021', 'W 95th St',
 'Chris O''Brien', '+15551110015', 'emergency',
 'b0000001-0000-0000-0000-000000000003', 'confirmed', 'ai_call', 'Frozen pipes - no water', NOW() - INTERVAL '2 days'),

('f0000001-0000-0000-0000-000000000012', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000017',
 NOW() + INTERVAL '2 days' + INTERVAL '10 hours', NOW() + INTERVAL '2 days' + INTERVAL '11 hours',
 '330 E 46th St, Apt 5D, New York, NY 10017', '10017', 'E 46th St',
 'Priya Sharma', '+15551110016', 'routine',
 'b0000001-0000-0000-0000-000000000002', 'confirmed', 'ai_call', 'Dead thermostat', NOW() - INTERVAL '1 day'),

('f0000001-0000-0000-0000-000000000013', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000018',
 NOW() + INTERVAL '3 days' + INTERVAL '11 hours', NOW() + INTERVAL '3 days' + INTERVAL '12 hours',
 '88 Greenwich St, New York, NY 10006', '10004', 'Greenwich St',
 'Alan Foster', '+15551110017', 'routine',
 'b0000001-0000-0000-0000-000000000001', 'confirmed', 'ai_call', 'Low water pressure - main line', NOW() - INTERVAL '6 hours'),

-- One cancelled appointment
('f0000001-0000-0000-0000-000000000014', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 'e0000001-0000-0000-0000-000000000008',
 NOW() - INTERVAL '8 days' + INTERVAL '15 hours', NOW() - INTERVAL '8 days' + INTERVAL '16 hours',
 '150 E 72nd St, New York, NY 10021', '10021', 'E 72nd St',
 'Carlos Rivera', '+15551110007', 'routine',
 'b0000001-0000-0000-0000-000000000003', 'cancelled', 'ai_call', 'Water heater inspection - cancelled by caller', NOW() - INTERVAL '10 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. LEADS (15 leads across all statuses for Kanban)
-- ============================================================
INSERT INTO leads (id, tenant_id, from_number, caller_name, job_type, service_address, postal_code, street_name, urgency, status, revenue_amount, primary_call_id, appointment_id, created_at, updated_at) VALUES

-- NEW leads (3)
('10000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110017', 'Alan Foster', 'Water Pressure Inspection', '88 Greenwich St, New York, NY 10006', '10004', 'Greenwich St',
 'routine', 'new', null,
 'e0000001-0000-0000-0000-000000000018', 'f0000001-0000-0000-0000-000000000013',
 NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),

('10000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110019', 'Emily Watson', 'Burst Pipe Repair', '25 Murray St, Apt 8, New York, NY 10007', '10004', 'Murray St',
 'emergency', 'new', null,
 'e0000001-0000-0000-0000-000000000020', null,
 NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),

('10000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110018', 'Sam Mitchell', 'Plumbing Inspection', null, null, null,
 'routine', 'new', null,
 'e0000001-0000-0000-0000-000000000019', null,
 NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

-- BOOKED leads (4)
('10000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110012', 'Derek Brown', 'Garbage Disposal Install', '42 Spring St, Apt 2, New York, NY 10003', '10003', 'Spring St',
 'routine', 'booked', null,
 'e0000001-0000-0000-0000-000000000013', 'f0000001-0000-0000-0000-000000000009',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

('10000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110014', 'Nina Patel', 'Shower Repair', '199 E 3rd St, New York, NY 10003', '10003', 'E 3rd St',
 'routine', 'booked', null,
 'e0000001-0000-0000-0000-000000000015', 'f0000001-0000-0000-0000-000000000010',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

('10000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110015', 'Chris O''Brien', 'Frozen Pipe Repair', '67 W 95th St, New York, NY 10025', '10021', 'W 95th St',
 'emergency', 'booked', null,
 'e0000001-0000-0000-0000-000000000016', 'f0000001-0000-0000-0000-000000000011',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

('10000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110016', 'Priya Sharma', 'Thermostat Replacement', '330 E 46th St, Apt 5D, New York, NY 10017', '10017', 'E 46th St',
 'routine', 'booked', null,
 'e0000001-0000-0000-0000-000000000017', 'f0000001-0000-0000-0000-000000000012',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- COMPLETED leads (3)
('10000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110010', 'Karen Patel', 'Sewer Line Repair', '501 W Houston St, New York, NY 10002', '10002', 'W Houston St',
 'emergency', 'completed', 850.00,
 'e0000001-0000-0000-0000-000000000011', 'f0000001-0000-0000-0000-000000000007',
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'),

('10000001-0000-0000-0000-000000000009', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110009', 'Tom Nguyen', 'Faucet Replacement', '78 Lexington Ave, New York, NY 10016', '10016', 'Lexington Ave',
 'routine', 'completed', 320.00,
 'e0000001-0000-0000-0000-000000000010', 'f0000001-0000-0000-0000-000000000006',
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days'),

('10000001-0000-0000-0000-000000000010', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110002', 'Lisa Thompson', 'Drain Cleaning', '220 E 23rd St, New York, NY 10010', '10016', 'E 23rd St',
 'routine', 'completed', 275.00,
 'e0000001-0000-0000-0000-000000000007', 'f0000001-0000-0000-0000-000000000008',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '4 days'),

-- PAID leads (3)
('10000001-0000-0000-0000-000000000011', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110001', 'Robert Martinez', 'Emergency Pipe Repair', '45 Broadway, Apt 3B, New York, NY 10004', '10004', 'Broadway',
 'emergency', 'paid', 1200.00,
 'e0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001',
 NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days'),

('10000001-0000-0000-0000-000000000012', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110004', 'James Kim', 'Gas Leak Detection', '89 Park Ave, Apt 12A, New York, NY 10016', '10016', 'Park Ave',
 'emergency', 'paid', 450.00,
 'e0000001-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000003',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),

('10000001-0000-0000-0000-000000000013', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110005', 'Angela Davis', 'Toilet Repair', '155 W 68th St, New York, NY 10023', '10021', 'W 68th St',
 'routine', 'paid', 185.00,
 'e0000001-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000004',
 NOW() - INTERVAL '13 days', NOW() - INTERVAL '8 days'),

-- LOST leads (2)
('10000001-0000-0000-0000-000000000014', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110003', 'Rachel Green', 'Water Heater Install', null, null, null,
 'high_ticket', 'lost', null,
 'e0000001-0000-0000-0000-000000000003', null,
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '12 days'),

('10000001-0000-0000-0000-000000000015', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '+15551110011', 'Victor Lee', 'Bathroom Re-piping', null, null, null,
 'high_ticket', 'lost', null,
 'e0000001-0000-0000-0000-000000000012', null,
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. LEAD_CALLS (junction table)
-- ============================================================
INSERT INTO lead_calls (lead_id, call_id) VALUES
  ('10000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000018'),
  ('10000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000020'),
  ('10000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000019'),
  ('10000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000013'),
  ('10000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000015'),
  ('10000001-0000-0000-0000-000000000006', 'e0000001-0000-0000-0000-000000000016'),
  ('10000001-0000-0000-0000-000000000007', 'e0000001-0000-0000-0000-000000000017'),
  ('10000001-0000-0000-0000-000000000008', 'e0000001-0000-0000-0000-000000000011'),
  ('10000001-0000-0000-0000-000000000009', 'e0000001-0000-0000-0000-000000000010'),
  ('10000001-0000-0000-0000-000000000010', 'e0000001-0000-0000-0000-000000000002'),
  ('10000001-0000-0000-0000-000000000010', 'e0000001-0000-0000-0000-000000000007'),
  ('10000001-0000-0000-0000-000000000011', 'e0000001-0000-0000-0000-000000000001'),
  ('10000001-0000-0000-0000-000000000012', 'e0000001-0000-0000-0000-000000000004'),
  ('10000001-0000-0000-0000-000000000013', 'e0000001-0000-0000-0000-000000000005'),
  ('10000001-0000-0000-0000-000000000014', 'e0000001-0000-0000-0000-000000000003'),
  ('10000001-0000-0000-0000-000000000015', 'e0000001-0000-0000-0000-000000000012')
ON CONFLICT (lead_id, call_id) DO NOTHING;

-- ============================================================
-- 10. INVOICES (8 invoices across all statuses)
-- ============================================================
INSERT INTO invoices (id, tenant_id, lead_id, invoice_number, status, customer_name, customer_phone, customer_email, customer_address, job_type, issued_date, due_date, notes, payment_terms, subtotal, tax_amount, total, sent_at, paid_at, created_at) VALUES

-- Paid invoices (3)
('20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000011', 'INV-2026-001', 'paid',
 'Robert Martinez', '+15551110001', 'robert.m@email.com', '45 Broadway, Apt 3B, New York, NY 10004',
 'Emergency Pipe Repair', (CURRENT_DATE - 18), (CURRENT_DATE - 18 + 30),
 'Emergency burst pipe repair including pipe replacement and water damage cleanup.',
 'Net 30', 1106.96, 93.04, 1200.00,
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '18 days'),

('20000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000012', 'INV-2026-002', 'paid',
 'James Kim', '+15551110004', 'james.kim@email.com', '89 Park Ave, Apt 12A, New York, NY 10016',
 'Gas Leak Detection', (CURRENT_DATE - 12), (CURRENT_DATE - 12 + 30),
 'Gas leak detection and repair at kitchen stove connection.',
 'Net 30', 414.75, 35.25, 450.00,
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days'),

('20000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000013', 'INV-2026-003', 'paid',
 'Angela Davis', '+15551110005', 'angela.d@email.com', '155 W 68th St, New York, NY 10023',
 'Toilet Repair', (CURRENT_DATE - 10), (CURRENT_DATE - 10 + 30),
 'Replaced flapper valve and fill valve assembly.',
 'Net 30', 170.51, 14.49, 185.00,
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days'),

-- Sent invoices (2) — one approaching due, one overdue
('20000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000008', 'INV-2026-004', 'sent',
 'Karen Patel', '+15551110010', 'karen.p@email.com', '501 W Houston St, New York, NY 10002',
 'Sewer Line Repair', (CURRENT_DATE - 5), (CURRENT_DATE + 25),
 'Emergency sewer line clearing and pipe repair.',
 'Net 30', 783.41, 66.59, 850.00,
 NOW() - INTERVAL '5 days', null, NOW() - INTERVAL '5 days'),

('20000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000009', 'INV-2026-005', 'overdue',
 'Tom Nguyen', '+15551110009', 'tom.n@email.com', '78 Lexington Ave, New York, NY 10016',
 'Faucet Replacement', (CURRENT_DATE - 35), (CURRENT_DATE - 5),
 'Kitchen faucet replacement including new Moen fixture.',
 'Net 30', 294.93, 25.07, 320.00,
 NOW() - INTERVAL '35 days', null, NOW() - INTERVAL '35 days'),

-- Partially paid invoice (1)
('20000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 '10000001-0000-0000-0000-000000000010', 'INV-2026-006', 'partially_paid',
 'Lisa Thompson', '+15551110002', 'lisa.t@email.com', '220 E 23rd St, New York, NY 10010',
 'Drain Cleaning', (CURRENT_DATE - 4), (CURRENT_DATE + 26),
 'Two-visit drain cleaning with camera inspection.',
 'Net 30', 253.46, 21.54, 275.00,
 NOW() - INTERVAL '4 days', null, NOW() - INTERVAL '4 days'),

-- Draft invoice (1)
('20000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'INV-2026-007', 'draft',
 'Maria Gonzalez', '+15551110008', null, '312 E 85th St, Apt 6C, New York, NY 10028',
 'Heating System Repair', CURRENT_DATE, (CURRENT_DATE + 30),
 'Emergency heating repair — replaced thermocouple and gas valve.',
 'Net 30', 506.24, 43.76, 550.00,
 null, null, NOW() - INTERVAL '1 day'),

-- Void invoice (1)
('20000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'INV-2026-008', 'void',
 'Carlos Rivera', '+15551110007', 'carlos.r@email.com', '150 E 72nd St, New York, NY 10021',
 'Water Heater Inspection', (CURRENT_DATE - 9), (CURRENT_DATE - 9 + 30),
 'Voided — appointment was cancelled by caller.',
 'Net 30', 138.25, 11.75, 150.00,
 null, null, NOW() - INTERVAL '9 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. INVOICE LINE ITEMS
-- ============================================================
INSERT INTO invoice_line_items (id, invoice_id, tenant_id, sort_order, item_type, description, quantity, unit_price, markup_pct, taxable, line_total) VALUES

-- INV-001 (Emergency Pipe Repair - $1200)
('30000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Emergency plumbing labor (3 hrs @ $150/hr)', 3, 150.00, 0, true, 450.00),
('30000001-0000-0000-0000-000000000002', '20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', '3/4" copper pipe and fittings', 1, 285.00, 0.15, true, 327.75),
('30000001-0000-0000-0000-000000000003', '20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'flat_rate', 'After-hours emergency surcharge', 1, 200.00, 0, true, 200.00),
('30000001-0000-0000-0000-000000000004', '20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 3, 'travel', 'Emergency dispatch travel', 1, 50.00, 0, true, 50.00),

-- INV-002 (Gas Leak Detection - $450)
('30000001-0000-0000-0000-000000000005', '20000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Gas leak detection and repair (2 hrs)', 2, 125.00, 0, true, 250.00),
('30000001-0000-0000-0000-000000000006', '20000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'Gas line fitting and sealant', 1, 85.00, 0, true, 85.00),
('30000001-0000-0000-0000-000000000007', '20000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'flat_rate', 'Gas leak inspection fee', 1, 75.00, 0, true, 75.00),

-- INV-003 (Toilet Repair - $185)
('30000001-0000-0000-0000-000000000008', '20000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Toilet repair labor (1 hr)', 1, 95.00, 0, true, 95.00),
('30000001-0000-0000-0000-000000000009', '20000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'Flapper valve and fill valve kit', 1, 45.00, 0, true, 45.00),
('30000001-0000-0000-0000-000000000010', '20000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'travel', 'Standard service call travel', 1, 35.00, 0, true, 35.00),

-- INV-004 (Sewer Line - $850)
('30000001-0000-0000-0000-000000000011', '20000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Sewer line clearing and repair (4 hrs)', 4, 125.00, 0, true, 500.00),
('30000001-0000-0000-0000-000000000012', '20000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'Sewer line repair materials', 1, 175.00, 0, true, 175.00),
('30000001-0000-0000-0000-000000000013', '20000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'flat_rate', 'Camera inspection', 1, 125.00, 0, true, 125.00),

-- INV-005 (Faucet - $320)
('30000001-0000-0000-0000-000000000014', '20000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Faucet replacement labor (1.5 hrs)', 1.5, 95.00, 0, true, 142.50),
('30000001-0000-0000-0000-000000000015', '20000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'Moen kitchen faucet with sprayer', 1, 145.00, 0, true, 145.00),

-- INV-006 (Drain Cleaning - $275)
('30000001-0000-0000-0000-000000000016', '20000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Drain cleaning labor (2 visits)', 2, 95.00, 0, true, 190.00),
('30000001-0000-0000-0000-000000000017', '20000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'flat_rate', 'Camera inspection', 1, 75.00, 0, true, 75.00),

-- INV-007 (Heating Repair draft - $550)
('30000001-0000-0000-0000-000000000018', '20000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Heating system diagnosis and repair (2.5 hrs)', 2.5, 130.00, 0, true, 325.00),
('30000001-0000-0000-0000-000000000019', '20000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'Thermocouple and gas valve', 1, 165.00, 0, true, 165.00),
('30000001-0000-0000-0000-000000000020', '20000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'travel', 'Emergency dispatch travel', 1, 45.00, 0, true, 45.00),

-- INV-008 (Void - $150)
('30000001-0000-0000-0000-000000000021', '20000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'flat_rate', 'Water heater inspection fee', 1, 150.00, 0, true, 150.00)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. INVOICE PAYMENTS (for paid + partially paid invoices)
-- ============================================================
INSERT INTO invoice_payments (id, invoice_id, tenant_id, amount, payment_date, note) VALUES
  ('40000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   1200.00, CURRENT_DATE - 14, 'Paid in full — check'),
  ('40000001-0000-0000-0000-000000000002', '20000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   450.00, CURRENT_DATE - 10, 'Paid in full — Venmo'),
  ('40000001-0000-0000-0000-000000000003', '20000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   185.00, CURRENT_DATE - 8, 'Paid in full — cash'),
  ('40000001-0000-0000-0000-000000000004', '20000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   150.00, CURRENT_DATE - 2, 'Partial payment — Zelle')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 13. ESTIMATES (4 estimates across statuses)
-- ============================================================
INSERT INTO estimates (id, tenant_id, lead_id, estimate_number, status, customer_name, customer_phone, customer_email, customer_address, job_type, created_date, valid_until, notes, subtotal, tax_amount, total, sent_at, approved_at, declined_at, created_at) VALUES

-- Sent estimate
('50000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'EST-2026-001', 'sent',
 'Rachel Green', '+15551110003', 'rachel.g@email.com', null,
 'Tankless Water Heater Install', (CURRENT_DATE - 15), (CURRENT_DATE + 15),
 'Navien NPE-240A tankless water heater installation with gas line modification.',
 2763.91, 236.09, 3000.00,
 NOW() - INTERVAL '14 days', null, null, NOW() - INTERVAL '15 days'),

-- Approved estimate (tiered)
('50000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'EST-2026-002', 'approved',
 'Patricia Howard', '+15551110020', 'patricia.h@email.com', '95 Christopher St, New York, NY 10014',
 'AC Unit Replacement', (CURRENT_DATE - 10), (CURRENT_DATE + 20),
 'Central AC unit replacement — 3 tier options.',
 null, null, null,
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '5 days', null, NOW() - INTERVAL '10 days'),

-- Draft estimate
('50000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'EST-2026-003', 'draft',
 'Victor Lee', '+15551110011', null, null,
 'Bathroom Re-piping', CURRENT_DATE, (CURRENT_DATE + 30),
 'Full bathroom re-pipe from galvanized to PEX.',
 3688.94, 311.06, 4000.00,
 null, null, null, NOW() - INTERVAL '2 days'),

-- Declined estimate
('50000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 null, 'EST-2026-004', 'declined',
 'Mark Sullivan', '+15551110021', 'mark.s@email.com', '420 E 64th St, New York, NY 10065',
 'Water Filtration System', (CURRENT_DATE - 20), (CURRENT_DATE - 5),
 'Whole-house water filtration system install.',
 2301.84, 198.16, 2500.00,
 NOW() - INTERVAL '18 days', null, NOW() - INTERVAL '10 days', NOW() - INTERVAL '20 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. ESTIMATE TIERS (for tiered AC estimate)
-- ============================================================
INSERT INTO estimate_tiers (id, estimate_id, tenant_id, tier_label, sort_order, subtotal, tax_amount, total) VALUES
  ('60000001-0000-0000-0000-000000000001', '50000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Good', 0, 3226.47, 273.53, 3500.00),
  ('60000001-0000-0000-0000-000000000002', '50000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Better', 1, 4152.61, 347.39, 4500.00),
  ('60000001-0000-0000-0000-000000000003', '50000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'Best', 2, 5078.76, 421.24, 5500.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. ESTIMATE LINE ITEMS
-- ============================================================
INSERT INTO estimate_line_items (id, estimate_id, tier_id, tenant_id, sort_order, item_type, description, quantity, unit_price, markup_pct, taxable, line_total) VALUES

-- EST-001 (single-price water heater)
('70000001-0000-0000-0000-000000000001', '50000001-0000-0000-0000-000000000001', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'materials', 'Navien NPE-240A tankless water heater', 1, 1650.00, 0, true, 1650.00),
('70000001-0000-0000-0000-000000000002', '50000001-0000-0000-0000-000000000001', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'labor', 'Installation labor (6 hrs)', 6, 130.00, 0, true, 780.00),
('70000001-0000-0000-0000-000000000003', '50000001-0000-0000-0000-000000000001', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Gas line modification parts', 1, 225.00, 0, true, 225.00),

-- EST-002 Good tier (basic AC)
('70000001-0000-0000-0000-000000000004', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'materials', 'Goodman 2.5-ton AC unit (14 SEER)', 1, 1800.00, 0, true, 1800.00),
('70000001-0000-0000-0000-000000000005', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'labor', 'Standard installation (8 hrs)', 8, 130.00, 0, true, 1040.00),
('70000001-0000-0000-0000-000000000006', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Refrigerant and fittings', 1, 350.00, 0, true, 350.00),

-- EST-002 Better tier (mid-range AC)
('70000001-0000-0000-0000-000000000007', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'materials', 'Carrier 3-ton AC unit (16 SEER)', 1, 2500.00, 0, true, 2500.00),
('70000001-0000-0000-0000-000000000008', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'labor', 'Installation with duct inspection (8 hrs)', 8, 140.00, 0, true, 1120.00),
('70000001-0000-0000-0000-000000000009', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Smart thermostat + refrigerant', 1, 500.00, 0, true, 500.00),

-- EST-002 Best tier (premium AC)
('70000001-0000-0000-0000-000000000010', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'materials', 'Trane 3-ton AC unit (20 SEER)', 1, 3200.00, 0, true, 3200.00),
('70000001-0000-0000-0000-000000000011', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'labor', 'Premium install with zone control (10 hrs)', 10, 140.00, 0, true, 1400.00),
('70000001-0000-0000-0000-000000000012', '50000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Ecobee smart thermostat + UV air purifier + refrigerant', 1, 750.00, 0, true, 750.00),

-- EST-003 (bathroom re-pipe draft)
('70000001-0000-0000-0000-000000000013', '50000001-0000-0000-0000-000000000003', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'labor', 'Full bathroom re-pipe labor (16 hrs)', 16, 130.00, 0, true, 2080.00),
('70000001-0000-0000-0000-000000000014', '50000001-0000-0000-0000-000000000003', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'materials', 'PEX piping, fittings, and valves', 1, 650.00, 0, true, 650.00),
('70000001-0000-0000-0000-000000000015', '50000001-0000-0000-0000-000000000003', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Wall repair materials', 1, 320.00, 0, true, 320.00),

-- EST-004 (water filtration declined)
('70000001-0000-0000-0000-000000000016', '50000001-0000-0000-0000-000000000004', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 0, 'materials', 'Whole-house water filtration system', 1, 1400.00, 0, true, 1400.00),
('70000001-0000-0000-0000-000000000017', '50000001-0000-0000-0000-000000000004', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 1, 'labor', 'Installation labor (5 hrs)', 5, 130.00, 0, true, 650.00),
('70000001-0000-0000-0000-000000000018', '50000001-0000-0000-0000-000000000004', null, '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
 2, 'materials', 'Bypass valve and sediment pre-filter', 1, 185.00, 0, true, 185.00)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 16. ACTIVITY LOG (20 recent entries)
-- ============================================================
INSERT INTO activity_log (id, tenant_id, event_type, lead_id, metadata, created_at) VALUES
  ('80000001-0000-0000-0000-000000000001', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000011',
   '{"caller_name": "Robert Martinez", "job_type": "Emergency Pipe Repair", "urgency": "emergency", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '21 days'),

  ('80000001-0000-0000-0000-000000000002', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'lead_created', '10000001-0000-0000-0000-000000000011',
   '{"caller_name": "Robert Martinez", "source": "ai_call"}'::jsonb,
   NOW() - INTERVAL '21 days'),

  ('80000001-0000-0000-0000-000000000003', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'appointment_booked', '10000001-0000-0000-0000-000000000012',
   '{"caller_name": "James Kim", "job_type": "Gas Leak Detection", "urgency": "emergency"}'::jsonb,
   NOW() - INTERVAL '14 days'),

  ('80000001-0000-0000-0000-000000000004', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'lead_status_changed', '10000001-0000-0000-0000-000000000011',
   '{"from": "completed", "to": "paid", "caller_name": "Robert Martinez"}'::jsonb,
   NOW() - INTERVAL '14 days'),

  ('80000001-0000-0000-0000-000000000005', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'invoice_paid', '10000001-0000-0000-0000-000000000011',
   '{"invoice_number": "INV-2026-001", "amount": 1200.00, "customer_name": "Robert Martinez"}'::jsonb,
   NOW() - INTERVAL '14 days'),

  ('80000001-0000-0000-0000-000000000006', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000013',
   '{"caller_name": "Angela Davis", "job_type": "Toilet Repair", "urgency": "routine", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '13 days'),

  ('80000001-0000-0000-0000-000000000007', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'invoice_paid', '10000001-0000-0000-0000-000000000012',
   '{"invoice_number": "INV-2026-002", "amount": 450.00, "customer_name": "James Kim"}'::jsonb,
   NOW() - INTERVAL '10 days'),

  ('80000001-0000-0000-0000-000000000008', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'estimate_sent', null,
   '{"estimate_number": "EST-2026-001", "customer_name": "Rachel Green", "total": 3000.00}'::jsonb,
   NOW() - INTERVAL '9 days'),

  ('80000001-0000-0000-0000-000000000009', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'invoice_paid', '10000001-0000-0000-0000-000000000013',
   '{"invoice_number": "INV-2026-003", "amount": 185.00, "customer_name": "Angela Davis"}'::jsonb,
   NOW() - INTERVAL '8 days'),

  ('80000001-0000-0000-0000-000000000010', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000008',
   '{"caller_name": "Karen Patel", "job_type": "Sewer Line Repair", "urgency": "emergency", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '7 days'),

  ('80000001-0000-0000-0000-000000000011', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'lead_status_changed', '10000001-0000-0000-0000-000000000008',
   '{"from": "booked", "to": "completed", "caller_name": "Karen Patel"}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('80000001-0000-0000-0000-000000000012', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'invoice_sent', '10000001-0000-0000-0000-000000000008',
   '{"invoice_number": "INV-2026-004", "amount": 850.00, "customer_name": "Karen Patel"}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('80000001-0000-0000-0000-000000000013', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'estimate_approved', null,
   '{"estimate_number": "EST-2026-002", "customer_name": "Patricia Howard", "total": 4500.00, "tier": "Better"}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('80000001-0000-0000-0000-000000000014', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000004',
   '{"caller_name": "Derek Brown", "job_type": "Garbage Disposal Install", "urgency": "routine", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('80000001-0000-0000-0000-000000000015', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'lead_status_changed', '10000001-0000-0000-0000-000000000015',
   '{"from": "new", "to": "lost", "caller_name": "Victor Lee"}'::jsonb,
   NOW() - INTERVAL '4 days'),

  ('80000001-0000-0000-0000-000000000016', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'invoice_payment_received', '10000001-0000-0000-0000-000000000010',
   '{"invoice_number": "INV-2026-006", "amount": 150.00, "customer_name": "Lisa Thompson", "note": "Partial payment"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  ('80000001-0000-0000-0000-000000000017', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000006',
   '{"caller_name": "Chris O''Brien", "job_type": "Frozen Pipe Repair", "urgency": "emergency", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  ('80000001-0000-0000-0000-000000000018', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'appointment_booked', '10000001-0000-0000-0000-000000000007',
   '{"caller_name": "Priya Sharma", "job_type": "Thermostat Replacement", "urgency": "routine"}'::jsonb,
   NOW() - INTERVAL '1 day'),

  ('80000001-0000-0000-0000-000000000019', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000001',
   '{"caller_name": "Alan Foster", "job_type": "Water Pressure Inspection", "urgency": "routine", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '6 hours'),

  ('80000001-0000-0000-0000-000000000020', '3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18',
   'call_completed', '10000001-0000-0000-0000-000000000002',
   '{"caller_name": "Emily Watson", "job_type": "Burst Pipe Repair", "urgency": "emergency", "booking_outcome": "booked"}'::jsonb,
   NOW() - INTERVAL '1 hour')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 17. INVOICE SEQUENCES (so next invoice gets correct number)
-- ============================================================
INSERT INTO invoice_sequences (tenant_id, year, next_number) VALUES
  ('3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 2026, 9)
ON CONFLICT (tenant_id, year) DO UPDATE SET next_number = GREATEST(invoice_sequences.next_number, 9);

-- ============================================================
-- 18. ESTIMATE SEQUENCES
-- ============================================================
INSERT INTO estimate_sequences (tenant_id, year, next_number) VALUES
  ('3b512e8d-d09b-4b0b-9d0a-9a9e21b37a18', 2026, 5)
ON CONFLICT (tenant_id, year) DO UPDATE SET next_number = GREATEST(estimate_sequences.next_number, 5);

COMMIT;

-- ============================================================
-- SUMMARY OF SEEDED DATA
-- ============================================================
-- Services:            6  (2 emergency, 2 high_ticket, 2 routine)
-- Service Zones:       3  (Downtown, Midtown, Upper East)
-- Zone Travel Buffers: 3  (20/25/35 min between zones)
-- Escalation Contacts: 3  (Owner, Office Manager, Senior Tech)
-- Invoice Settings:    1  (Premier Plumbing & HVAC, 8.75% tax)
-- Calls:              20  (5 emergency, 4 high_ticket, 11 routine)
-- Appointments:       14  (8 completed, 5 confirmed, 1 cancelled)
-- Leads:              15  (3 new, 4 booked, 3 completed, 3 paid, 2 lost)
-- Lead-Call links:    16  (including 1 repeat caller with 2 calls)
-- Invoices:            8  (3 paid, 1 sent, 1 overdue, 1 partially_paid, 1 draft, 1 void)
-- Invoice Line Items: 21
-- Invoice Payments:    4  (3 full, 1 partial)
-- Estimates:           4  (1 sent, 1 approved/tiered, 1 draft, 1 declined)
-- Estimate Tiers:      3  (Good/Better/Best for AC replacement)
-- Estimate Line Items:18
-- Activity Log:       20  (calls, status changes, payments, estimates)
-- ============================================================
