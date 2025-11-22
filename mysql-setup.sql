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