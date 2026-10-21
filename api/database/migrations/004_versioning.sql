-- Checklist versions history
CREATE TABLE IF NOT EXISTS checklist_versions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT UNSIGNED NOT NULL,
    version_number INT NOT NULL,
    diff_json JSON NOT NULL,
    author_id INT UNSIGNED NOT NULL,
    changelog VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_checklist_version (checklist_id, version_number DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM('checklist_updated', 'checklist_approved', 'report_resolved', 'reputation_change') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(500) NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT UNSIGNED NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscribers
CREATE TABLE IF NOT EXISTS checklist_subscribers (
    user_id INT UNSIGNED NOT NULL,
    checklist_id INT UNSIGNED NOT NULL,
    subscribed_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, checklist_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
