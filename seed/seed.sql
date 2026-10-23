-- Fictional seed data for local/dev only. No real people, emails, or phones.
-- Package rows must match src/config/plans.ts. Apply after migrations: npm run db:seed:local

INSERT INTO packages (id, product_line, name, slug, setup_price_cents, monthly_price_cents, description, sort_order) VALUES
  ('11111111-0000-4000-8000-000000000001', 'parvitium', 'One-Page', 'parvitium-one-page', 79700, 3900, 'One page on your own domain. $797 setup + $39/mo website + hosting.', 10),
  ('11111111-0000-4000-8000-000000000002', 'parvitium', 'Starter', 'parvitium-starter', 120000, 4900, '1–3 pages. $1,200 setup + $49/mo. Optional year-one plan: $600 deposit then $99/mo × 12.', 20),
  ('11111111-0000-4000-8000-000000000003', 'parvitium', 'Job Pages', 'parvitium-job-pages', 240000, 9900, '5–7 pages. $2,400 setup + $99/mo. Optional year-one plan: $1,200 deposit then $199/mo × 12.', 30),
  ('11111111-0000-4000-8000-000000000010', 'tooele_trades', 'Free listing', 'tt-free', 0, 0, 'Free TooeleTrades.com directory listing.', 100),
  ('11111111-0000-4000-8000-000000000011', 'tooele_trades', 'Pro Listing', 'tt-pro-listing', 0, 2900, 'TooeleTrades Pro Listing. $29/mo, listed above free listings.', 110),
  ('11111111-0000-4000-8000-000000000012', 'tooele_trades', 'Featured + Leads', 'tt-featured-leads', 0, 7900, 'Featured (Sponsored) directory placement plus lead routing. $79/mo.', 120),
  ('11111111-0000-4000-8000-000000000013', 'tooele_trades', 'Managed Growth', 'tt-managed-growth', 0, 22900, 'Directory plus managed marketing. $229/mo.', 130);

INSERT INTO website_templates (id, name, slug, description, preview_url, created_at) VALUES
  ('12121212-0000-4000-8000-000000000001', 'One-Pager Trade', 'one-pager-trade', 'Hero, services, service area, contact.', 'https://templates.parvitium.example/one-pager', '2026-01-10T00:00:00.000Z'),
  ('12121212-0000-4000-8000-000000000002', 'Trades Home', 'trades-home', 'Home, about, services, gallery, contact.', 'https://templates.parvitium.example/trades-home', '2026-01-10T00:00:00.000Z'),
  ('12121212-0000-4000-8000-000000000003', 'Job Pages', 'job-pages', 'Home plus per-job landing pages.', 'https://templates.parvitium.example/job-pages', '2026-02-01T00:00:00.000Z');

INSERT INTO customers (id, kind, business_name, contact_name, contact_email, phone, city, county, notes, external_crm_name, external_crm_url, created_at, updated_at) VALUES
  ('22222222-0000-4000-8000-000000000001', 'both', 'Summit Ridge Roofing LLC', 'Jordan Hale', 'jordan@summitridge.example', '435-555-0101', 'Tooele', 'Tooele', 'Fictional roofer. Website client plus TooeleTrades Pro Listing.', 'Jobber', 'https://secure.getjobber.example/summit', '2026-03-01T16:00:00.000Z', '2026-10-01T16:00:00.000Z'),
  ('22222222-0000-4000-8000-000000000002', 'parvitium', 'Copper Peak Plumbing LLC', 'Riley Chen', 'riley@copperpeak.example', '435-555-0102', 'Grantsville', 'Tooele', 'Fictional plumber. Emergency after-hours line.', NULL, NULL, '2026-04-12T16:00:00.000Z', '2026-10-10T16:00:00.000Z'),
  ('22222222-0000-4000-8000-000000000003', 'parvitium', 'Lakeview Electric Co.', 'Sam Ortiz', 'sam@lakeviewelectric.example', '435-555-0103', 'Stansbury Park', 'Tooele', 'Fictional electrician. One-page site live.', NULL, NULL, '2026-05-20T16:00:00.000Z', '2026-09-15T16:00:00.000Z'),
  ('22222222-0000-4000-8000-000000000004', 'tooele_trades', 'Desert Sage Landscaping LLC', 'Morgan Ellis', 'morgan@desertsage.example', '435-555-0104', 'Tooele', 'Tooele', 'Fictional landscaper listed on TooeleTrades.', 'Housecall Pro', 'https://pro.housecallpro.example/desert', '2026-06-08T16:00:00.000Z', '2026-10-18T16:00:00.000Z'),
  ('22222222-0000-4000-8000-000000000005', 'tooele_trades', 'Wasatch Fence Co.', 'Alex Brooks', 'alex@wasatchfence.example', '435-555-0105', 'Erda', 'Tooele', 'Fictional fencer. Free directory listing.', NULL, NULL, '2026-07-02T16:00:00.000Z', '2026-10-02T16:00:00.000Z');

INSERT INTO users (id, email, display_name, role, created_at) VALUES
  ('33333333-0000-4000-8000-000000000001', 'adam@parvitium.example', 'Adam Lundell', 'admin', '2026-01-01T00:00:00.000Z');

INSERT INTO subscriptions (id, customer_id, package_id, status, stripe_customer_id, stripe_subscription_id, stripe_payment_link_id, current_period_end, created_at, updated_at) VALUES
  ('44444444-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'active', 'cus_mock_summit', 'sub_mock_summit', 'plink_mock_summit', '2026-11-01T00:00:00.000Z', '2026-03-01T16:00:00.000Z', '2026-10-01T16:00:00.000Z'),
  ('44444444-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000011', 'active', 'cus_mock_summit', 'sub_mock_summit_tt', 'plink_mock_summit_tt', '2026-11-01T00:00:00.000Z', '2026-08-01T16:00:00.000Z', '2026-10-01T16:00:00.000Z'),
  ('44444444-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', 'past_due', 'cus_mock_copper', 'sub_mock_copper', 'plink_mock_copper', '2026-10-12T00:00:00.000Z', '2026-04-12T16:00:00.000Z', '2026-10-12T16:00:00.000Z'),
  ('44444444-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'active', 'cus_mock_lakeview', NULL, 'plink_mock_lakeview', '2026-11-20T00:00:00.000Z', '2026-05-20T16:00:00.000Z', '2026-09-20T16:00:00.000Z'),
  ('44444444-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000012', 'active', 'cus_mock_desert', 'sub_mock_desert', 'plink_mock_desert', '2026-11-08T00:00:00.000Z', '2026-06-08T16:00:00.000Z', '2026-10-08T16:00:00.000Z'),
  ('44444444-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000010', 'active', NULL, NULL, NULL, NULL, '2026-07-02T16:00:00.000Z', '2026-07-02T16:00:00.000Z');

INSERT INTO payments (id, customer_id, subscription_id, stripe_payment_intent_id, amount_cents, currency, status, paid_at, created_at) VALUES
  ('45454545-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001', 'pi_mock_summit_setup', 120000, 'usd', 'paid', '2026-03-01T16:10:00.000Z', '2026-03-01T16:10:00.000Z'),
  ('45454545-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001', 'pi_mock_summit_oct', 4900, 'usd', 'paid', '2026-10-01T12:00:00.000Z', '2026-10-01T12:00:00.000Z'),
  ('45454545-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000002', 'pi_mock_copper_oct', 9900, 'usd', 'failed', NULL, '2026-10-12T12:00:00.000Z');

INSERT INTO websites (id, customer_id, template_id, name, url, status, notes, created_at, updated_at) VALUES
  ('55555555-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '12121212-0000-4000-8000-000000000002', 'Summit Ridge Roofing', 'https://summitridge.example', 'live', 'Launched March 2026.', '2026-03-15T00:00:00.000Z', '2026-03-15T00:00:00.000Z'),
  ('55555555-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002', '12121212-0000-4000-8000-000000000003', 'Copper Peak Plumbing', 'https://copperpeak.example', 'in_progress', 'Job pages for drain, water heater, sewer.', '2026-04-20T00:00:00.000Z', '2026-10-14T00:00:00.000Z'),
  ('55555555-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000003', '12121212-0000-4000-8000-000000000001', 'Lakeview Electric', 'https://lakeviewelectric.example', 'live', 'One-page.', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO social_accounts (id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes) VALUES
  ('66666666-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'facebook', 'partner_granted', 'jordan@summitridge.example', '2026-09-01T00:00:00.000Z', 'op://Parvitium/summit-ridge-facebook', 'Meta Business Suite partner access.'),
  ('66666666-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'instagram', 'partner_granted', 'jordan@summitridge.example', '2026-09-01T00:00:00.000Z', 'op://Parvitium/summit-ridge-instagram', NULL),
  ('66666666-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', 'facebook', 'requested', 'riley@copperpeak.example', NULL, NULL, 'Waiting on partner invite accept.'),
  ('66666666-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000003', 'youtube', 'none', 'sam@lakeviewelectric.example', NULL, NULL, NULL),
  ('66666666-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000004', 'tiktok', 'delegated', 'morgan@desertsage.example', '2026-08-15T00:00:00.000Z', 'op://Parvitium/desert-sage-tiktok', 'Creator Studio delegated.');

INSERT INTO gbp_profiles (id, customer_id, place_id, name, address, phone, maps_url, rating, review_count, last_synced_at) VALUES
  ('67676767-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'ChIJmocksummit', 'Summit Ridge Roofing LLC', '100 Mock Ridge Rd, Tooele, UT 84074', '435-555-0101', 'https://maps.example/summit', 4.8, 42, '2026-10-18T00:00:00.000Z'),
  ('67676767-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002', 'ChIJmockcopper', 'Copper Peak Plumbing LLC', '50 Mock Copper St, Grantsville, UT 84029', '435-555-0102', 'https://maps.example/copper', 4.6, 19, '2026-10-10T00:00:00.000Z'),
  ('67676767-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000003', 'ChIJmocklake', 'Lakeview Electric Co.', '12 Mock Lake Dr, Stansbury Park, UT 84074', '435-555-0103', 'https://maps.example/lakeview', 5.0, 8, '2026-09-15T00:00:00.000Z'),
  ('67676767-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000004', NULL, 'Desert Sage Landscaping LLC', 'Tooele, UT', '435-555-0104', NULL, NULL, NULL, NULL);

INSERT INTO seo_snapshots (id, customer_id, website_id, captured_at, keyword, search_engine, rank, ai_citation_score, ai_citation_notes, source) VALUES
  ('68686868-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', '2026-10-01T00:00:00.000Z', 'roofing tooele ut', 'google', 3, 0.42, 'Cited in two mock AI answers.', 'mock'),
  ('68686868-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', '2026-10-15T00:00:00.000Z', 'roofing tooele ut', 'google', 2, 0.55, 'Rank improved, one new AI citation.', 'mock'),
  ('68686868-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000002', '2026-10-15T00:00:00.000Z', 'plumber grantsville', 'google', 11, 0.10, 'Not yet cited.', 'mock'),
  ('68686868-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000003', '55555555-0000-4000-8000-000000000003', '2026-10-15T00:00:00.000Z', 'electrician stansbury park', 'google', 6, 0.20, 'Mentioned once in a mock local pack answer.', 'mock');

INSERT INTO call_logs (id, customer_id, external_id, direction, from_number, to_number, started_at, duration_seconds, disposition, transcript_preview, recording_r2_key) VALUES
  ('69696969-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'retell_mock_001', 'inbound', '+14355550199', '+14355550101', '2026-10-16T15:04:00.000Z', 186, 'booked', 'Caller asked for a roof leak inspection this week.', 'calls/summit/retell_mock_001.wav'),
  ('69696969-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'retell_mock_002', 'inbound', '+14355550188', '+14355550101', '2026-10-17T21:12:00.000Z', 74, 'after_hours_voicemail', 'Storm damage question; asked for a callback.', NULL),
  ('69696969-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000003', 'retell_mock_003', 'inbound', '+14355550177', '+14355550103', '2026-10-14T18:30:00.000Z', 240, 'booked', 'Panel upgrade quote request.', NULL);

INSERT INTO review_items (id, customer_id, source, author_name, rating, body, received_at, status, draft_reply, posted_at) VALUES
  ('70707070-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'google', 'A. Fictional', 5, 'Showed up the day after the wind storm. Clean work.', '2026-10-12T00:00:00.000Z', 'posted', 'Thanks — glad we could get you dried in quickly.', '2026-10-12T18:00:00.000Z'),
  ('70707070-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'google', 'B. Example', 3, 'Good repair, took two extra days.', '2026-10-18T00:00:00.000Z', 'drafted', 'Sorry for the delay — materials were back-ordered. Appreciate the patience.', NULL),
  ('70707070-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', 'google', 'C. Sample', 4, 'Fixed a leaking water heater the same afternoon.', '2026-10-09T00:00:00.000Z', 'new', NULL, NULL);

INSERT INTO messages (id, customer_id, from_role, subject, body, created_at, is_flagged, flag_reason, flag_resolved_at) VALUES
  ('71717171-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', 'customer', 'Card declined', 'Hey Adam — the card on file failed. Can you send a new Payment Link?', '2026-10-13T14:00:00.000Z', 1, 'Payment issue', NULL),
  ('71717171-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'admin', 'Review draft ready', 'Drafted a reply to the 3-star review.', '2026-10-18T16:00:00.000Z', 0, NULL, NULL),
  ('71717171-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000004', 'customer', 'Need more photos on listing', 'Can we add the backyard patio set to the TooeleTrades page?', '2026-10-19T17:00:00.000Z', 0, NULL, NULL);

INSERT INTO flags (id, customer_id, message_id, kind, severity, title, detail, status, created_at, resolved_at) VALUES
  ('72727272-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', '71717171-0000-4000-8000-000000000001', 'payment_past_due', 'urgent', 'Copper Peak past due', 'October invoice failed. Customer asked for a new Payment Link.', 'open', '2026-10-13T14:01:00.000Z', NULL),
  ('72727272-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000004', NULL, 'gbp_disconnected', 'warn', 'Desert Sage GBP not connected', 'No place_id yet. Cannot sync reviews.', 'open', '2026-10-08T00:00:00.000Z', NULL),
  ('72727272-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', NULL, 'review_needs_reply', 'info', 'Summit Ridge 3-star draft', 'AI review manager drafted a reply; waiting on Adam.', 'open', '2026-10-18T00:05:00.000Z', NULL);

INSERT INTO tickets (id, customer_id, title, description, type, stage, assigned_to, qa_by, qa_result, qa_date, qa_notes, created_at, updated_at, closed_at) VALUES
  ('73737373-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', 'Finish drain-cleaning job page', 'Copy and photos are in the shared folder.', 'dev', 'in-dev', NULL, NULL, NULL, NULL, NULL, '2026-10-10T00:00:00.000Z', '2026-10-16T00:00:00.000Z', NULL),
  ('73737373-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'Add financing FAQ', 'Customer asked for a short FAQ block.', 'dev', 'in-qa', NULL, NULL, NULL, NULL, NULL, '2026-10-12T00:00:00.000Z', '2026-10-18T00:00:00.000Z', NULL),
  ('73737373-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000004', 'Upload patio photos to listing', 'Three JPEGs from the customer.', 'task', 'needs-adam', NULL, '33333333-0000-4000-8000-000000000001', 'pass', '2026-10-19T00:00:00.000Z', 'Looks good on staging.', '2026-10-14T00:00:00.000Z', '2026-10-19T00:00:00.000Z', NULL),
  ('73737373-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000003', 'Swap hero photo', 'New truck photo.', 'dev', 'closed', NULL, '33333333-0000-4000-8000-000000000001', 'pass', '2026-09-01T00:00:00.000Z', 'Live.', '2026-08-20T00:00:00.000Z', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'),
  ('73737373-0000-4000-8000-000000000005', NULL, 'Retell tool Worker spike', 'November call-agent tools on a Worker.', 'dev', 'backlog', NULL, NULL, NULL, NULL, NULL, '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z', NULL),
  ('73737373-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000002', 'Send new Stripe Payment Link', 'After card decline.', 'task', 'ready', NULL, NULL, NULL, NULL, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z', NULL);

INSERT INTO ticket_history (id, ticket_id, from_stage, to_stage, actor_user_id, note, created_at) VALUES
  ('74747474-0000-4000-8000-000000000001', '73737373-0000-4000-8000-000000000004', 'backlog', 'ready', '33333333-0000-4000-8000-000000000001', 'Scoped.', '2026-08-21T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000002', '73737373-0000-4000-8000-000000000004', 'ready', 'in-dev', '33333333-0000-4000-8000-000000000001', NULL, '2026-08-22T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000003', '73737373-0000-4000-8000-000000000004', 'in-dev', 'in-qa', '33333333-0000-4000-8000-000000000001', NULL, '2026-08-28T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000004', '73737373-0000-4000-8000-000000000004', 'in-qa', 'needs-adam', '33333333-0000-4000-8000-000000000001', 'QA pass', '2026-09-01T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000005', '73737373-0000-4000-8000-000000000004', 'needs-adam', 'closed', '33333333-0000-4000-8000-000000000001', 'Shipped.', '2026-09-02T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000006', '73737373-0000-4000-8000-000000000002', 'backlog', 'ready', '33333333-0000-4000-8000-000000000001', NULL, '2026-10-13T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000007', '73737373-0000-4000-8000-000000000002', 'ready', 'in-dev', '33333333-0000-4000-8000-000000000001', NULL, '2026-10-14T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000008', '73737373-0000-4000-8000-000000000002', 'in-dev', 'in-qa', '33333333-0000-4000-8000-000000000001', 'Ready for QA pass.', '2026-10-18T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000009', '73737373-0000-4000-8000-000000000003', 'in-qa', 'in-dev', '33333333-0000-4000-8000-000000000001', 'QA fail: wrong crop on photo 2.', '2026-10-17T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000010', '73737373-0000-4000-8000-000000000003', 'in-dev', 'in-qa', '33333333-0000-4000-8000-000000000001', 'Recropped.', '2026-10-18T00:00:00.000Z'),
  ('74747474-0000-4000-8000-000000000011', '73737373-0000-4000-8000-000000000003', 'in-qa', 'needs-adam', '33333333-0000-4000-8000-000000000001', 'QA pass', '2026-10-19T00:00:00.000Z');
