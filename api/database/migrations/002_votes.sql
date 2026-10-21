-- Votes system
CREATE TABLE IF NOT EXISTS checklist_votes (
    user_id INT UNSIGNED NOT NULL,
    checklist_id INT UNSIGNED NOT NULL,
    value TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, checklist_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    INDEX idx_checklist_votes (checklist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE checklists ADD COLUMN vote_score INT DEFAULT 0;
ALTER TABLE checklists ADD COLUMN vote_count INT DEFAULT 0;
ALTER TABLE checklists ADD COLUMN fork_count INT DEFAULT 0;
