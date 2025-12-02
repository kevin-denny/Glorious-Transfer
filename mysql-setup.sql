-- =============================================
--               DATABASE CHANGES
-- =============================================

USE glorious_transfer;

-- =============================================

-- 19-11-2025

UPDATE tours
SET status='Pending' WHERE status = 'pending';

ALTER TABLE tours
ADD COLUMN pickup CHAR(255);

ALTER TABLE tours
ADD COLUMN destination CHAR(255);

-- 22-11-2025

ALTER TABLE auth_users
ADD COLUMN last_login_at TIMESTAMP;

ALTER TABLE activity_logs
ADD COLUMN status VARCHAR(50);

-- 23-11-2025

ALTER TABLE auth_users
ADD COLUMN status ENUM('Inactive', 'Active', 'Deactive') DEFAULT 'Inactive';

-- 24-11-2025

ALTER TABLE auth_users
MODIFY COLUMN status ENUM('Inactive', 'Active', 'Deactive') DEFAULT 'Inactive';

UPDATE auth_users
SET status='Inactive' WHERE status = 'inactive';

UPDATE auth_users
SET status='Active' WHERE status = 'active';

-- 25-11-2025

ALTER TABLE `glorious_transfer`.`payments` 
CHANGE COLUMN `status` `status` VARCHAR(50) NOT NULL DEFAULT 'Pending' ;

ALTER TABLE payments
ADD COLUMN paid_amount DECIMAL(10, 2),
ADD COLUMN currency CHAR(10),
ADD COLUMN type CHAR(50);

-- 26-11-2025

ALTER TABLE payments 
DROP FOREIGN KEY payments_ibfk_1;

ALTER TABLE payments 
DROP INDEX idx_driver_id;

-- 01-12-2025

ALTER TABLE tours
ADD COLUMN category ENUM('Arrival', 'Departure', 'Round Tour', '-') DEFAULT '-';

ALTER TABLE tours
ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE tours
ADD COLUMN currency CHAR(10);

ALTER TABLE tours
ADD COLUMN agent_ref CHAR(50);

ALTER TABLE `glorious_transfer`.`tours` 
CHANGE COLUMN `arrival_datetime` `arrival_datetime` TIMESTAMP NULL ,
CHANGE COLUMN `departure_datetime` `departure_datetime` TIMESTAMP NULL ;

ALTER TABLE tours
ADD COLUMN pickup_datetime TIMESTAMP;

ALTER TABLE assignments
ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- 02-12-2025

ALTER TABLE assignments
ADD COLUMN currency CHAR(10);

ALTER TABLE assignments
ADD COLUMN paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;
