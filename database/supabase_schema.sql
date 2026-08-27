-- ============================================================
--  Hambin ERP — Supabase Database Schema
--  PostgreSQL compatible schema for Supabase
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
--  1. USERS & AUTHENTICATION
--  Note: Supabase manages auth.users, we link via user_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('superadmin', 'admin', 'sales', 'finance', 'viewer')),
  active BOOLEAN NOT NULL DEFAULT true,
  phone VARCHAR(30),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  2. CRM — CLIENTS & SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL,
  company VARCHAR(180) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  whatsapp VARCHAR(30),
  email VARCHAR(120) NOT NULL,
  cnic_ntn VARCHAR(50),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  payment_terms TEXT NOT NULL,
  credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(180) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  wechat VARCHAR(50),
  whatsapp VARCHAR(30),
  email VARCHAR(120) NOT NULL,
  country VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  city VARCHAR(100),
  warehouse_address TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  payment_terms TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  bank_info TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  3. PRODUCTS & CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE price_point AS (
  date DATE,
  supplier_id UUID,
  currency TEXT,
  amount NUMERIC(18,2)
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  chinese_name VARCHAR(180),
  category VARCHAR(120) NOT NULL,
  subcategory VARCHAR(120),
  description TEXT,
  spec TEXT,
  unit VARCHAR(30) NOT NULL,
  default_supplier_id UUID NOT NULL REFERENCES suppliers(id),
  default_currency TEXT NOT NULL CHECK (default_currency IN ('RMB', 'USD', 'EUR')),
  default_price NUMERIC(18,2) NOT NULL,
  weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  cbm NUMERIC(10,4) NOT NULL DEFAULT 0,
  hs_code VARCHAR(20),
  customs_category VARCHAR(120),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  price_history price_point[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  4. SOURCING REQUESTS
-- ============================================================

CREATE TYPE sourcing_status AS ENUM (
  'New', 'Searching', 'Supplier Found', 'Quotation Received',
  'Client Quotation Prepared', 'Approved', 'Rejected', 'Converted to Order'
);

CREATE TABLE IF NOT EXISTS sourcing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty NUMERIC(18,2) NOT NULL,
  spec TEXT,
  target_price_pkr NUMERIC(18,2),
  target_date DATE,
  notes TEXT,
  agent_id UUID NOT NULL REFERENCES user_profiles(id),
  status sourcing_status NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sourcing_request_id UUID NOT NULL REFERENCES sourcing_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  unit_price NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('RMB', 'USD', 'EUR')),
  moq NUMERIC(18,2),
  lead_time_days INTEGER,
  valid_until DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  5. ORDERS & ORDER ITEMS
-- ============================================================

CREATE TYPE order_status AS ENUM ('Draft', 'Sent', 'Confirmed', 'Production', 'Ready', 'Shipped', 'Completed', 'Cancelled');

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  status order_status NOT NULL DEFAULT 'Draft',
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  shipping_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  other_costs NUMERIC(18,2) NOT NULL DEFAULT 0,
  expected_date DATE,
  actual_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty NUMERIC(18,2) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('RMB', 'USD', 'EUR')),
  line_total NUMERIC(18,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  6. QUOTATIONS
-- ============================================================

CREATE TYPE quotation_status AS ENUM ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted');

CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  sourcing_request_id UUID REFERENCES sourcing_requests(id),
  status quotation_status NOT NULL DEFAULT 'Draft',
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  profit_margin NUMERIC(5,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  terms_conditions TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty NUMERIC(18,2) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  line_total NUMERIC(18,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  7. SHIPMENTS
-- ============================================================

CREATE TYPE shipment_status AS ENUM (
  'Pending', 'Picked Up', 'In Transit', 'Customs Clearance',
  'Arrived', 'Delivered', 'On Hold', 'Cancelled'
);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id),
  status shipment_status NOT NULL DEFAULT 'Pending',
  carrier VARCHAR(120),
  tracking_number VARCHAR(100),
  container_number VARCHAR(30),
  seal_number VARCHAR(30),
  etd DATE,
  eta DATE,
  atd DATE,
  ata DATE,
  origin_port VARCHAR(100),
  destination_port VARCHAR(100),
  freight_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  freight_currency TEXT CHECK (freight_currency IN ('RMB', 'USD', 'EUR')),
  insurance_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  customs_duty NUMERIC(18,2) NOT NULL DEFAULT 0,
  other_charges NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_landed_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  documents TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty NUMERIC(18,2) NOT NULL,
  carton_count INTEGER,
  weight_kg NUMERIC(10,3),
  cbm NUMERIC(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  8. FINANCE — PAYMENTS, EXPENSES, LEDGERS
-- ============================================================

CREATE TYPE payment_type AS ENUM ('Receipt', 'Payment', 'Expense', 'Adjustment');
CREATE TYPE payment_method AS ENUM ('Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other');

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  type payment_type NOT NULL,
  method payment_method NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  pkr_equivalent NUMERIC(18,2) NOT NULL,
  client_id UUID REFERENCES clients(id),
  supplier_id UUID REFERENCES suppliers(id),
  order_id UUID REFERENCES orders(id),
  invoice_id UUID,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  attachment_url TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  pkr_equivalent NUMERIC(18,2) NOT NULL,
  payment_date DATE NOT NULL,
  vendor VARCHAR(180),
  description TEXT,
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(100),
  attachment_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'supplier')),
  entity_id UUID NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  reason TEXT NOT NULL,
  adjustment_date DATE NOT NULL,
  reference VARCHAR(100),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  9. COMPANY SETTINGS & EXCHANGE RATES
-- ============================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(180) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(120),
  website VARCHAR(120),
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR' CHECK (currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  fiscal_year_start DATE NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency TEXT NOT NULL CHECK (from_currency IN ('RMB', 'USD', 'EUR')),
  to_currency TEXT NOT NULL CHECK (to_currency IN ('PKR', 'RMB', 'USD', 'EUR')),
  rate NUMERIC(18,6) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, effective_date)
);

-- ============================================================
--  10. AUDIT LOG & NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS) — Basic setup
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = auth_id);

-- Policy: Allow authenticated users to read most data
CREATE POLICY "Authenticated users can read data" ON clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read suppliers" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read products" ON products
  FOR SELECT TO authenticated USING (true);

-- Add more specific policies based on roles as needed

-- ============================================================
--  INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_orders_number ON orders(number);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_quotations_number ON quotations(number);
CREATE INDEX idx_shipments_number ON shipments(number);
CREATE INDEX idx_payments_number ON payments(number);
CREATE INDEX idx_expenses_number ON expenses(number);
CREATE INDEX idx_invoices_number ON invoices(number);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- ============================================================
--  TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
