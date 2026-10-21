-- VIP Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    plan ENUM('monthly', 'yearly', 'lifetime') NOT NULL,
    status ENUM('active', 'cancelled', 'expired', 'pending') DEFAULT 'pending',
    payment_provider ENUM('stripe', 'paypal') NULL,
    payment_id VARCHAR(255) NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    starts_at DATETIME NULL,
    expires_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_expires (expires_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN is_vip TINYINT(1) DEFAULT 0 AFTER role;
ALTER TABLE users ADD COLUMN vip_expires_at DATETIME NULL AFTER is_vip;

-- Payment logs
CREATE TABLE IF NOT EXISTS payment_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    subscription_id INT UNSIGNED NULL,
    event VARCHAR(100) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_event_id VARCHAR(255) NULL,
    amount_cents INT NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
