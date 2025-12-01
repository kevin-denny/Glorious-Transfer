-- Glorious Transfer MySQL Database Schema

DROP DATABASE IF EXISTS glorious_transfer;
CREATE DATABASE glorious_transfer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE glorious_transfer;

-- =============================================
-- AUTH USERS TABLE
-- =============================================
CREATE TABLE auth_users (
  id CHAR(36) PRIMARY KEY NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  email_confirmed_at TIMESTAMP NULL,
  raw_user_meta_data JSON,
  status ENUM('Inactive', 'Active', 'Deactive') DEFAULT 'Inactive',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('administrator', 'finance', 'operations') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- =============================================
-- DRIVERS TABLE
-- =============================================
CREATE TABLE drivers (
  id CHAR(36) PRIMARY KEY NOT NULL,
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
  `status` ENUM('Active', 'Inactive') DEFAULT 'Inactive',
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
  customer_name VARCHAR(255) NOT NULL,
  agent VARCHAR(255) NOT NULL,
  pax INT NOT NULL,
  contact_details TEXT NOT NULL,
  arrival_datetime TIMESTAMP,
  departure_datetime TIMESTAMP,
  pickup_datetime TIMESTAMP,
  flight_no VARCHAR(50),
  remarks TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36),
  pickup VARCHAR(255),
  destination VARCHAR(255),
  category ENUM('Arrival', 'Departure', 'Round Tour', '-') DEFAULT '-',
  currency CHAR(10),
  agent_ref CHAR(50),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_booking_date (booking_date),
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
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by CHAR(36),
  paid_amount DECIMAL(10, 2),
  currency CHAR(10),
  type CHAR(50),
  FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL,
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
  status VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_entity_id (entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE assignments (
	id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tour_id CHAR(36),
    driver_id CHAR(36),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by CHAR(36),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    INDEX idx_tour_id (tour_id),
    INDEX idx_driver_id (driver_id)
) ENGINE=InnoDB;