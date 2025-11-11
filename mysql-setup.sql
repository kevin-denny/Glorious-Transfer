-- Glorious Transfer MySQL Database Schema
-- Complete conversion from Supabase PostgreSQL

DROP DATABASE IF EXISTS glorious_transfer;
CREATE DATABASE glorious_transfer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE glorious_transfer;

-- =============================================
-- AUTH USERS TABLE (replacing Supabase auth.users)
-- =============================================
CREATE TABLE auth_users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  email_confirmed_at TIMESTAMP NULL,
  raw_user_meta_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('administrator', 'finance', 'operations') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE user_roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  role ENUM('administrator', 'finance', 'operations') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_role (user_id, role),
  INDEX idx_user_id (user_id),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- =============================================
-- DRIVERS TABLE
-- =============================================
CREATE TABLE drivers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  driver_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  languages JSON NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL,
  vehicle_plate VARCHAR(50) NOT NULL,
  number_of_rides INT NOT NULL DEFAULT 0,
  complaints JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36),
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_driver_number (driver_number),
  INDEX idx_name (name),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB;

-- =============================================
-- TOURS TABLE
-- =============================================
CREATE TABLE tours (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_date DATE NOT NULL,
  booking_ref VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  agent VARCHAR(255) NOT NULL,
  pax INT NOT NULL,
  contact_details TEXT NOT NULL,
  arrival_datetime TIMESTAMP NOT NULL,
  departure_datetime TIMESTAMP NOT NULL,
  flight_no VARCHAR(50),
  flight_time TIME,
  remarks TEXT,
  driver_id CHAR(36),
  assigned_at TIMESTAMP NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_booking_ref (booking_ref),
  INDEX idx_booking_date (booking_date),
  INDEX idx_driver_id (driver_id),
  INDEX idx_status (status),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB;

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  driver_id CHAR(36) NOT NULL,
  tour_id CHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by CHAR(36),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_driver_id (driver_id),
  INDEX idx_tour_id (tour_id),
  INDEX idx_status (status),
  INDEX idx_paid_at (paid_at)
) ENGINE=InnoDB;

-- =============================================
-- ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE activity_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  user_name VARCHAR(255) NOT NULL,
  user_role ENUM('administrator', 'finance', 'operations') NOT NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_entity_id (entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- =============================================
-- STORED FUNCTIONS
-- =============================================

-- Function to check if user has a specific role
DELIMITER $$
CREATE FUNCTION has_role(_user_id CHAR(36), _role VARCHAR(50))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE role_exists BOOLEAN;
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = _role
  ) INTO role_exists;
  RETURN role_exists;
END$$
DELIMITER ;

-- Function to generate unique driver number
DELIMITER $$
CREATE FUNCTION generate_driver_number()
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
  DECLARE new_number VARCHAR(20);
  DECLARE exists_check INT;
  REPEAT
    SET new_number = CONCAT('DRV', LPAD(FLOOR(RAND() * 99999 + 1), 5, '0'));
    SELECT COUNT(*) INTO exists_check FROM drivers WHERE driver_number = new_number;
  UNTIL exists_check = 0 END REPEAT;
  RETURN new_number;
END$$
DELIMITER ;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to auto-generate driver number
DELIMITER $$
CREATE TRIGGER before_driver_insert
BEFORE INSERT ON drivers
FOR EACH ROW
BEGIN
  IF NEW.driver_number IS NULL OR NEW.driver_number = '' THEN
    SET NEW.driver_number = generate_driver_number();
  END IF;
  IF NEW.languages IS NULL THEN
    SET NEW.languages = JSON_ARRAY();
  END IF;
  IF NEW.complaints IS NULL THEN
    SET NEW.complaints = JSON_ARRAY();
  END IF;
END$$
DELIMITER ;

-- Trigger to auto-create profile and user_role on user signup
DELIMITER $$
CREATE TRIGGER after_auth_user_insert
AFTER INSERT ON auth_users
FOR EACH ROW
BEGIN
  DECLARE user_full_name VARCHAR(255);
  DECLARE user_role VARCHAR(50);
  
  SET user_full_name = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.raw_user_meta_data, '$.full_name')), 'User');
  SET user_role = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.raw_user_meta_data, '$.role')), 'operations');
  
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, user_full_name, user_role);
  
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, user_role);
END$$
DELIMITER ;

-- Trigger to auto-create payment when tour is assigned
DELIMITER $$
CREATE TRIGGER after_tour_assign
AFTER INSERT ON tours
FOR EACH ROW
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO payments (driver_id, tour_id, amount)
    VALUES (NEW.driver_id, NEW.id, 100.00);
  END IF;
END$$

CREATE TRIGGER after_tour_update_driver
AFTER UPDATE ON tours
FOR EACH ROW
BEGIN
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id != NEW.driver_id) THEN
    INSERT INTO payments (driver_id, tour_id, amount)
    VALUES (NEW.driver_id, NEW.id, 100.00);
  END IF;
END$$
DELIMITER ;

-- =============================================
-- VIEWS (Replacing RLS policies with views)
-- =============================================

-- View for users to see their own profile
CREATE VIEW user_profile_view AS
SELECT * FROM profiles;

-- View for finance and administrators to see payments
CREATE VIEW payments_finance_view AS
SELECT p.* FROM payments p;

-- View for all authenticated users to see drivers
CREATE VIEW drivers_public_view AS
SELECT * FROM drivers;

-- View for all authenticated users to see tours
CREATE VIEW tours_public_view AS
SELECT * FROM tours;

-- =============================================
-- SAMPLE DATA (Optional)
-- =============================================

-- Insert a sample admin user (password: 'admin123' - you should hash this properly)
-- INSERT INTO auth_users (id, email, encrypted_password, raw_user_meta_data)
-- VALUES (
--   UUID(),
--   'admin@glorioustransfer.com',
--   '$2a$10$example_hashed_password',
--   JSON_OBJECT('full_name', 'Admin User', 'role', 'administrator')
-- );

-- =============================================
-- GRANTS (Adjust based on your application user)
-- =============================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON glorious_transfer.* TO 'app_user'@'localhost';
-- FLUSH PRIVILEGES;
