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
ADD COLUMN status ENUM('inactive', 'active', 'deactive') DEFAULT 'inactive';

-- 24-11-2025

ALTER TABLE auth_users
MODIFY COLUMN status ENUM('Inactive', 'Active', 'Deactive') DEFAULT 'Inactive';

UPDATE auth_users
SET status='Inactive' WHERE status = 'inactive';

UPDATE auth_users
SET status='Active' WHERE status = 'active';
