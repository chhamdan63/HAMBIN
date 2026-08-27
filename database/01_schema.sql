-- ============================================================
--  Hambin ERP — MySQL Database Schema
--  Compatible with Hostinger / cPanel / MySQL 5.7+ & MariaDB 10.3+
--  Charset: utf8mb4   Collation: utf8mb4_unicode_ci
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------
--  1. USERS & AUTHENTICATION
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`              VARCHAR(36)   NOT NULL,
  `name`            VARCHAR(120)  NOT NULL,
  `email`           VARCHAR(120)  NOT NULL,
  `password`        VARCHAR(255)  NOT NULL,
  `role`            ENUM('superadmin','admin','sales','finance','viewer') NOT NULL DEFAULT 'viewer',
  `active`          TINYINT(1)    NOT NULL DEFAULT 1,
  `phone`           VARCHAR(30)   DEFAULT NULL,
  `last_login`      DATETIME      DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id`              VARCHAR(64)   NOT NULL,
  `user_id`         VARCHAR(36)   NOT NULL,
  `ip_address`      VARCHAR(45)   DEFAULT NULL,
  `user_agent`      VARCHAR(255)  DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`      DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  2. CRM — CLIENTS & SUPPLIERS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `clients` (
  `id`               VARCHAR(36)   NOT NULL,
  `code`             VARCHAR(30)   NOT NULL,
  `company`          VARCHAR(180)  NOT NULL,
  `contact_person`   VARCHAR(120)  NOT NULL,
  `phone`            VARCHAR(30)   NOT NULL,
  `whatsapp`         VARCHAR(30)   DEFAULT NULL,
  `email`            VARCHAR(120)  NOT NULL,
  `cnic_ntn`         VARCHAR(60)   DEFAULT NULL,
  `address`          TEXT          NOT NULL,
  `city`             VARCHAR(80)   NOT NULL,
  `province`         VARCHAR(80)   NOT NULL,
  `country`          VARCHAR(80)   NOT NULL,
  `currency`         ENUM('PKR','RMB','USD') NOT NULL DEFAULT 'PKR',
  `payment_terms`    VARCHAR(120)  NOT NULL,
  `credit_limit`     DECIMAL(18,2) NOT NULL DEFAULT 0,
  `opening_balance`  DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `notes`            TEXT          DEFAULT NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clients_code` (`code`),
  KEY `idx_clients_company` (`company`),
  KEY `idx_clients_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`               VARCHAR(36)   NOT NULL,
  `code`             VARCHAR(30)   NOT NULL,
  `name`             VARCHAR(180)  NOT NULL,
  `contact_person`   VARCHAR(120)  NOT NULL,
  `phone`            VARCHAR(30)   NOT NULL,
  `wechat`           VARCHAR(60)   DEFAULT NULL,
  `whatsapp`         VARCHAR(30)   DEFAULT NULL,
  `email`            VARCHAR(120)  NOT NULL,
  `country`          VARCHAR(80)   NOT NULL,
  `province`         VARCHAR(80)   NOT NULL,
  `city`             VARCHAR(80)   NOT NULL,
  `warehouse_address` TEXT         DEFAULT NULL,
  `categories`       TEXT          DEFAULT NULL,
  `payment_terms`    VARCHAR(120)  NOT NULL,
  `currency`         ENUM('PKR','RMB','USD') NOT NULL DEFAULT 'RMB',
  `bank_info`        TEXT          DEFAULT NULL,
  `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `notes`            TEXT          DEFAULT NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_suppliers_code` (`code`),
  KEY `idx_suppliers_name` (`name`),
  KEY `idx_suppliers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  3. PRODUCTS & CATEGORIES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id`              VARCHAR(36)   NOT NULL,
  `name`            VARCHAR(120)  NOT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id`                  VARCHAR(36)   NOT NULL,
  `sku`                 VARCHAR(60)   NOT NULL,
  `name`                VARCHAR(180)  NOT NULL,
  `chinese_name`        VARCHAR(180)  DEFAULT NULL,
  `category`            VARCHAR(120)  DEFAULT NULL,
  `subcategory`         VARCHAR(120)  DEFAULT NULL,
  `description`         TEXT          DEFAULT NULL,
  `spec`                TEXT          DEFAULT NULL,
  `unit`                VARCHAR(30)   NOT NULL DEFAULT 'pcs',
  `default_supplier_id` VARCHAR(36)   DEFAULT NULL,
  `default_currency`    ENUM('RMB','USD') NOT NULL DEFAULT 'RMB',
  `default_price`       DECIMAL(18,2) NOT NULL DEFAULT 0,
  `weight_kg`           DECIMAL(14,4) NOT NULL DEFAULT 0,
  `cbm`                 DECIMAL(14,4) NOT NULL DEFAULT 0,
  `hs_code`             VARCHAR(30)   NOT NULL DEFAULT '',
  `customs_category`    VARCHAR(80)   NOT NULL DEFAULT '',
  `notes`               TEXT          DEFAULT NULL,
  `status`              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_sku` (`sku`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_supplier` (`default_supplier_id`),
  KEY `idx_products_status` (`status`),
  CONSTRAINT `fk_products_supplier` FOREIGN KEY (`default_supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_price_history` (
  `id`            VARCHAR(36)   NOT NULL,
  `product_id`    VARCHAR(36)   NOT NULL,
  `date`          DATE          NOT NULL,
  `supplier_id`   VARCHAR(36)   NOT NULL,
  `currency`      ENUM('RMB','USD') NOT NULL,
  `amount`        DECIMAL(18,2) NOT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pph_product` (`product_id`),
  KEY `idx_pph_supplier` (`supplier_id`),
  CONSTRAINT `fk_pph_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pph_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  4. SOURCING & QUOTES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sourcing_requests` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `client_id`       VARCHAR(36)   NOT NULL,
  `product_id`      VARCHAR(36)   NOT NULL,
  `qty`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `spec`            TEXT          DEFAULT NULL,
  `target_price_pkr` DECIMAL(18,2) DEFAULT NULL,
  `target_date`     DATE          DEFAULT NULL,
  `notes`           TEXT          DEFAULT NULL,
  `agent_id`        VARCHAR(36)   NOT NULL,
  `status`          ENUM('New','Searching','Supplier Found','Quotation Received','Client Quotation Prepared','Approved','Rejected','Converted to Order') NOT NULL DEFAULT 'New',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sourcing_number` (`number`),
  KEY `idx_sourcing_client`  (`client_id`),
  KEY `idx_sourcing_product` (`product_id`),
  KEY `idx_sourcing_agent`   (`agent_id`),
  KEY `idx_sourcing_status`  (`status`),
  CONSTRAINT `fk_sourcing_client`  FOREIGN KEY (`client_id`)  REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sourcing_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sourcing_agent`   FOREIGN KEY (`agent_id`)   REFERENCES `users`   (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_quotes` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `request_id`      VARCHAR(36)   DEFAULT NULL,
  `supplier_id`     VARCHAR(36)   NOT NULL,
  `product_id`      VARCHAR(36)   NOT NULL,
  `qty`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `unit_price`      DECIMAL(18,2) NOT NULL,
  `currency`        ENUM('RMB','USD') NOT NULL,
  `moq`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `terms`           VARCHAR(200)  DEFAULT NULL,
  `lead_time_days`  INT UNSIGNED  NOT NULL DEFAULT 0,
  `packaging_cost`  DECIMAL(18,2) NOT NULL DEFAULT 0,
  `china_freight`   DECIMAL(18,2) NOT NULL DEFAULT 0,
  `valid_until`     DATE          NOT NULL,
  `notes`           TEXT          DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sq_number` (`number`),
  KEY `idx_sq_request`  (`request_id`),
  KEY `idx_sq_supplier` (`supplier_id`),
  KEY `idx_sq_product`  (`product_id`),
  CONSTRAINT `fk_sq_request`  FOREIGN KEY (`request_id`)  REFERENCES `sourcing_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sq_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`         (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sq_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`          (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  5. EXCHANGE RATES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exchange_rates` (
  `id`              VARCHAR(36)   NOT NULL,
  `currency`        ENUM('RMB','USD') NOT NULL,
  `rate_to_pkr`     DECIMAL(14,4) NOT NULL,
  `effective_date`  DATE          NOT NULL,
  `source`          VARCHAR(120)  NOT NULL,
  `notes`           VARCHAR(255)  DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fx_currency_date` (`currency`,`effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  6. QUOTATIONS  (with landed snapshots as JSON)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quotations` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `client_id`       VARCHAR(36)   NOT NULL,
  `date`            DATE          NOT NULL,
  `valid_until`     DATE          NOT NULL,
  `discount_pkr`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `payment_terms`   VARCHAR(200)  NOT NULL,
  `delivery_terms`  VARCHAR(200)  NOT NULL,
  `notes`           TEXT          DEFAULT NULL,
  `status`          ENUM('Draft','Sent','Viewed','Accepted','Rejected','Expired','Converted to Order') NOT NULL DEFAULT 'Draft',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quotations_number` (`number`),
  KEY `idx_quotations_client` (`client_id`),
  KEY `idx_quotations_status` (`status`),
  CONSTRAINT `fk_quotations_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id`              VARCHAR(36)   NOT NULL,
  `quotation_id`    VARCHAR(36)   NOT NULL,
  `product_id`      VARCHAR(36)   NOT NULL,
  `description`     TEXT          DEFAULT NULL,
  `qty`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `snapshot`        JSON          NOT NULL,
  `sort_order`      INT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_qi_quotation` (`quotation_id`),
  KEY `idx_qi_product`   (`product_id`),
  CONSTRAINT `fk_qi_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qi_product`   FOREIGN KEY (`product_id`)   REFERENCES `products`   (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  7. ORDERS  (with immutable landed snapshots as JSON)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id`                  VARCHAR(36)   NOT NULL,
  `number`              VARCHAR(40)   NOT NULL,
  `client_id`           VARCHAR(36)   NOT NULL,
  `quotation_id`        VARCHAR(36)   DEFAULT NULL,
  `date`                DATE          NOT NULL,
  `currency`            ENUM('PKR','RMB','USD') NOT NULL DEFAULT 'RMB',
  `rate_snapshot`       JSON          NOT NULL,
  `payment_terms`       VARCHAR(200)  NOT NULL,
  `advance_required_pct` DECIMAL(8,4) NOT NULL DEFAULT 0,
  `status`              ENUM('Draft','Confirmed','Supplier Ordered','China Warehouse','Ready for Shipment','In Transit','Customs','Delivered','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  `notes`               TEXT          DEFAULT NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_number` (`number`),
  KEY `idx_orders_client`    (`client_id`),
  KEY `idx_orders_quotation` (`quotation_id`),
  KEY `idx_orders_status`    (`status`),
  KEY `idx_orders_date`      (`date`),
  CONSTRAINT `fk_orders_client`    FOREIGN KEY (`client_id`)    REFERENCES `clients`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id`              VARCHAR(36)   NOT NULL,
  `order_id`        VARCHAR(36)   NOT NULL,
  `product_id`      VARCHAR(36)   NOT NULL,
  `supplier_id`     VARCHAR(36)   NOT NULL,
  `hs_code`         VARCHAR(30)   DEFAULT NULL,
  `snapshot`        JSON          NOT NULL,
  `sort_order`      INT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_oi_order`    (`order_id`),
  KEY `idx_oi_product`  (`product_id`),
  KEY `idx_oi_supplier` (`supplier_id`),
  CONSTRAINT `fk_oi_order`    FOREIGN KEY (`order_id`)    REFERENCES `orders`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  8. SHIPMENTS  (Air / Sea with docs & timeline)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shipments` (
  `id`                  VARCHAR(36)   NOT NULL,
  `number`              VARCHAR(40)   NOT NULL,
  `order_ids`           TEXT          NOT NULL,
  `method`              ENUM('Air','Sea') NOT NULL,
  `origin`              VARCHAR(120)  NOT NULL,
  `destination`         VARCHAR(120)  NOT NULL,
  `forwarder`           VARCHAR(180)  NOT NULL,
  `tracking_no`         VARCHAR(120)  DEFAULT NULL,
  `current_location`    VARCHAR(180)  DEFAULT NULL,
  `status`              ENUM('Preparing','Warehouse','Booked','In Transit','Arrived','Customs','Cleared','Out for Delivery','Delivered') NOT NULL DEFAULT 'Preparing',
  `air_details`         JSON          DEFAULT NULL,
  `sea_details`         JSON          DEFAULT NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shipments_number` (`number`),
  KEY `idx_shipments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shipment_docs` (
  `id`              VARCHAR(36)   NOT NULL,
  `shipment_id`     VARCHAR(36)   NOT NULL,
  `name`            VARCHAR(180)  NOT NULL,
  `kind`            VARCHAR(60)   NOT NULL,
  `size`            VARCHAR(30)   NOT NULL,
  `path`            VARCHAR(255)  DEFAULT NULL,
  `uploaded_at`     DATETIME      NOT NULL,
  `by`              VARCHAR(120)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sd_shipment` (`shipment_id`),
  CONSTRAINT `fk_sd_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shipment_timeline` (
  `id`              VARCHAR(36)   NOT NULL,
  `shipment_id`     VARCHAR(36)   NOT NULL,
  `at`              DATETIME      NOT NULL,
  `label`           VARCHAR(80)   NOT NULL,
  `note`            VARCHAR(255)  DEFAULT NULL,
  `sort_order`      INT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_st_shipment` (`shipment_id`),
  CONSTRAINT `fk_st_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  9. FINANCE — PAYMENTS, EXPENSES, INVOICES, LEDGER
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `date`            DATE          NOT NULL,
  `type`            ENUM('Client Advance','Client Partial','Client Final','Supplier Payment','Expense Payment','Refund') NOT NULL,
  `party_kind`      ENUM('client','supplier') NOT NULL,
  `party_id`        VARCHAR(36)   NOT NULL,
  `invoice_id`      VARCHAR(36)   DEFAULT NULL,
  `order_id`        VARCHAR(36)   DEFAULT NULL,
  `amount`          DECIMAL(18,2) NOT NULL,
  `currency`        ENUM('PKR','RMB','USD') NOT NULL,
  `rate_to_pkr`     DECIMAL(14,4) NOT NULL DEFAULT 1,
  `amount_pkr`      DECIMAL(18,2) NOT NULL,
  `method`          ENUM('Cash','Bank Transfer','Online Transfer','Other') NOT NULL,
  `reference`       VARCHAR(120)  DEFAULT NULL,
  `notes`           TEXT          DEFAULT NULL,
  `void`            TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`      VARCHAR(120)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_number` (`number`),
  KEY `idx_payments_party`  (`party_kind`,`party_id`),
  KEY `idx_payments_date`   (`date`),
  KEY `idx_payments_invoice`(`invoice_id`),
  KEY `idx_payments_order`  (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `date`            DATE          NOT NULL,
  `category`        VARCHAR(80)   NOT NULL,
  `description`     VARCHAR(255)  NOT NULL,
  `amount`          DECIMAL(18,2) NOT NULL,
  `currency`        ENUM('PKR','RMB','USD') NOT NULL,
  `rate_to_pkr`     DECIMAL(14,4) NOT NULL DEFAULT 1,
  `amount_pkr`      DECIMAL(18,2) NOT NULL,
  `method`          ENUM('Cash','Bank Transfer','Online Transfer','Other') NOT NULL,
  `order_id`        VARCHAR(36)   DEFAULT NULL,
  `attachment`      VARCHAR(255)  DEFAULT NULL,
  `notes`           TEXT          DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_expenses_number` (`number`),
  KEY `idx_expenses_category` (`category`),
  KEY `idx_expenses_date`     (`date`),
  KEY `idx_expenses_order`    (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id`              VARCHAR(36)   NOT NULL,
  `number`          VARCHAR(40)   NOT NULL,
  `order_id`        VARCHAR(36)   NOT NULL,
  `client_id`       VARCHAR(36)   NOT NULL,
  `date`            DATE          NOT NULL,
  `due_date`        DATE          NOT NULL,
  `subtotal_pkr`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `freight_pkr`     DECIMAL(18,2) NOT NULL DEFAULT 0,
  `customs_pkr`     DECIMAL(18,2) NOT NULL DEFAULT 0,
  `tax_pkr`         DECIMAL(18,2) NOT NULL DEFAULT 0,
  `discount_pkr`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `grand_total_pkr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `notes`           TEXT          DEFAULT NULL,
  `void`            TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`      VARCHAR(120)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoices_number` (`number`),
  KEY `idx_invoices_client`  (`client_id`),
  KEY `idx_invoices_order`   (`order_id`),
  KEY `idx_invoices_due`     (`due_date`),
  CONSTRAINT `fk_invoices_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id`              VARCHAR(36)   NOT NULL,
  `invoice_id`      VARCHAR(36)   NOT NULL,
  `description`     VARCHAR(255)  NOT NULL,
  `qty`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `unit_price`      DECIMAL(18,2) NOT NULL DEFAULT 0,
  `amount`          DECIMAL(18,2) NOT NULL DEFAULT 0,
  `sort_order`      INT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ii_invoice` (`invoice_id`),
  CONSTRAINT `fk_ii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ledger_adjustments` (
  `id`              VARCHAR(36)   NOT NULL,
  `date`            DATE          NOT NULL,
  `party_kind`      ENUM('client','supplier') NOT NULL,
  `party_id`        VARCHAR(36)   NOT NULL,
  `description`     VARCHAR(255)  NOT NULL,
  `debit_pkr`       DECIMAL(18,2) NOT NULL DEFAULT 0,
  `credit_pkr`      DECIMAL(18,2) NOT NULL DEFAULT 0,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`      VARCHAR(120)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_adj_party` (`party_kind`,`party_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  10. AUDIT LOG & NOTICES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`              VARCHAR(36)   NOT NULL,
  `at`              DATETIME      NOT NULL,
  `user_id`         VARCHAR(36)   NOT NULL,
  `user_name`       VARCHAR(120)  NOT NULL,
  `action`          VARCHAR(120)  NOT NULL,
  `module`          VARCHAR(80)   NOT NULL,
  `ref_id`          VARCHAR(60)   NOT NULL,
  `detail`          TEXT          DEFAULT NULL,
  `ip`              VARCHAR(45)   DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user`   (`user_id`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_at`     (`at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notices` (
  `id`              VARCHAR(36)   NOT NULL,
  `at`              DATETIME      NOT NULL,
  `kind`            ENUM('order','payment','shipment','sourcing','invoice','system') NOT NULL,
  `title`           VARCHAR(180)  NOT NULL,
  `body`            TEXT          NOT NULL,
  `read`            TINYINT(1)    NOT NULL DEFAULT 0,
  `user_id`         VARCHAR(36)   DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notices_user` (`user_id`),
  KEY `idx_notices_read` (`read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  11. COMPANY SETTINGS  (single-row config table)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_settings` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`             VARCHAR(180)  NOT NULL,
  `tagline`          VARCHAR(180)  DEFAULT NULL,
  `address`          TEXT          NOT NULL,
  `phone`            VARCHAR(30)   NOT NULL,
  `email`            VARCHAR(120)  NOT NULL,
  `website`          VARCHAR(180)  DEFAULT NULL,
  `ntn`              VARCHAR(60)   DEFAULT NULL,
  `tax_info`         TEXT          DEFAULT NULL,
  `invoice_prefix`   VARCHAR(20)   NOT NULL DEFAULT 'INV',
  `quotation_prefix` VARCHAR(20)   NOT NULL DEFAULT 'QT',
  `order_prefix`     VARCHAR(20)   NOT NULL DEFAULT 'ORD',
  `shipment_prefix`  VARCHAR(20)   NOT NULL DEFAULT 'SHP',
  `currency`         ENUM('PKR','RMB','USD') NOT NULL DEFAULT 'PKR',
  `bank_name`        VARCHAR(180)  DEFAULT NULL,
  `account_title`    VARCHAR(180)  DEFAULT NULL,
  `account_no`       VARCHAR(60)   DEFAULT NULL,
  `iban`             VARCHAR(40)   DEFAULT NULL,
  `logo`             MEDIUMTEXT    DEFAULT NULL,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
--  12. SEQUENCES / COUNTERS  (for auto-numbering)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sequences` (
  `name`            VARCHAR(40)   NOT NULL,
  `value`           INT UNSIGNED  NOT NULL DEFAULT 0,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  End of schema
-- ============================================================
