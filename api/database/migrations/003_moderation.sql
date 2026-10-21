-- Reports system
CREATE TABLE IF NOT EXISTS reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT UNSIGNED NOT NULL,
    checklist_id INT UNSIGNED NOT NULL,
    reason ENUM('spam', 'incorrect', 'incomplete', 'duplicate', 'offensive') NOT NULL,
    message VARCHAR(500) NULL,
    status ENUM('pending', 'confirmed', 'dismissed') DEFAULT 'pending',
    reviewed_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    resolved_at DATETIME NULL,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_checklist_status (checklist_id, status),
    INDEX idx_pending (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reputation log
CREATE TABLE IF NOT EXISTS reputation_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    points INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    reference_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE checklists ADD COLUMN report_count INT DEFAULT 0;
