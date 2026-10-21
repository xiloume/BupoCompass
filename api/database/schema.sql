-- BupoCompass Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS bupocompass
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bupocompass;

-- Users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    reputation INT DEFAULT 0,
    role ENUM('user', 'moderator', 'admin') DEFAULT 'user',
    created_at DATETIME NOT NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- Games
CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    cover_url VARCHAR(500) NULL,
    igdb_id INT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- Checklists
CREATE TABLE checklists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    version INT DEFAULT 1,
    status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'draft',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_game_status (game_id, status),
    INDEX idx_author (author_id)
) ENGINE=InnoDB;

-- Zones
CREATE TABLE checklist_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    INDEX idx_checklist (checklist_id)
) ENGINE=InnoDB;

-- Items
CREATE TABLE checklist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zone_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    total INT DEFAULT 1,
    category VARCHAR(100) NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (zone_id) REFERENCES checklist_zones(id) ON DELETE CASCADE,
    INDEX idx_zone (zone_id)
) ENGINE=InnoDB;

-- User Progress (separate from items for multi-user support)
CREATE TABLE user_progress (
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    current INT DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES checklist_items(id) ON DELETE CASCADE,
    INDEX idx_user_updated (user_id, updated_at)
) ENGINE=InnoDB;
