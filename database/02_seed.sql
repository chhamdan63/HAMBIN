-- ============================================================
--  Hambin ERP — Initial Seed Data
--  Run AFTER 01_schema.sql
--  Creates: Users, Categories, Exchange Rates, Settings, Sequences
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------
--  USERS  (2 default accounts)
-- -----------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `active`, `phone`, `last_login`) VALUES
('u1', 'Admin',     'admin@hambin.com', 'hambin2024',  'admin',      1, NULL, NULL),
('u2', 'Developer', 'dev@hambin.com',   'devpass2024', 'superadmin', 1, NULL, NULL);

-- -----------------------------------------------------------
--  CATEGORIES
-- -----------------------------------------------------------
INSERT INTO `categories` (`id`, `name`) VALUES
('cat1', 'Electrical & Lighting'),
('cat2', 'Solar & Energy'),
('cat3', 'Tools & Hardware'),
('cat4', 'Home Appliances');

-- -----------------------------------------------------------
--  EXCHANGE RATES  (current market)
-- -----------------------------------------------------------
INSERT INTO `exchange_rates` (`id`, `currency`, `rate_to_pkr`, `effective_date`, `source`, `notes`) VALUES
('fx-rmb-1', 'RMB', 39.8000, CURDATE(),     'Open market',   NULL),
('fx-usd-1', 'USD', 280.0000, CURDATE(),    'Interbank',     NULL);

-- -----------------------------------------------------------
--  COMPANY SETTINGS  (single row)
-- -----------------------------------------------------------
INSERT INTO `company_settings`
(`name`, `tagline`, `address`, `phone`, `email`, `website`, `ntn`, `tax_info`,
 `invoice_prefix`, `quotation_prefix`, `order_prefix`, `shipment_prefix`,
 `currency`, `bank_name`, `account_title`, `account_no`, `iban`, `logo`)
VALUES
('Hambin International', 'Trading & Consultancy',
 'Suite 14, 2nd Floor, Al-Habib Tower, Gulberg III, Lahore, Pakistan',
 '+92 42 3575 8890', 'info@hambinintl.com', 'www.hambinintl.com',
 'NTN 4471820-6', 'Sales Tax Reg. No. 25-77-8812-041-99 · PRA registered',
 'HITC-INV', 'HITC-QT', 'HITC-ORD', 'HITC-SHP',
 'PKR',
 'Meezan Bank — Gulberg III Branch, Lahore',
 'Hambin International Trading & Consultancy',
 '0102-8834-5512-9907',
 'PK36 MEZN 0001 0208 8345 5129',
 NULL);

-- -----------------------------------------------------------
--  SEQUENCES / COUNTERS
-- -----------------------------------------------------------
INSERT INTO `sequences` (`name`, `value`) VALUES
('client',     0),
('supplier',   0),
('product',    0),
('sourcing',   0),
('quote',      0),
('quotation',  0),
('order',      0),
('shipment',   0),
('payment',    0),
('expense',    0),
('invoice',    0),
('adjustment', 0);

-- -----------------------------------------------------------
--  INITIAL AUDIT ENTRY
-- -----------------------------------------------------------
INSERT INTO `audit_log`
(`id`, `at`, `user_id`, `user_name`, `action`, `module`, `ref_id`, `detail`, `ip`)
VALUES
('a-init', NOW(), 'u2', 'Developer', 'System initialized', 'System', 'INIT',
 'Fresh production database initialized.', '127.0.0.1');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  Login Credentials
--  ---------------------------------------------------------
--  Admin:      admin@hambin.com   / hambin2024
--  Developer:  dev@hambin.com     / devpass2024
-- ============================================================
