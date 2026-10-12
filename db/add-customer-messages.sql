-- =============================================================================
-- Polar Fiber – Customer Messages Migration
-- Safe to run on a live database. All changes are additive.
-- Run: node db/migrate.mjs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. customer_conversations  – conversation threads between customer and admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_conversations (
  conversation_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  subject         VARCHAR(200) NOT NULL,
  topic           VARCHAR(100) NOT NULL DEFAULT 'General Inquiry',
  status          ENUM('Awaiting Reply', 'Admin Replied', 'Resolved') NOT NULL DEFAULT 'Awaiting Reply',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

ALTER TABLE customer_conversations
  ADD INDEX IF NOT EXISTS idx_customer_conversations_user (user_id),
  ADD INDEX IF NOT EXISTS idx_customer_conversations_status (status),
  ADD INDEX IF NOT EXISTS idx_customer_conversations_updated (updated_at);

-- -----------------------------------------------------------------------------
-- 2. customer_messages  – individual messages within a conversation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_messages (
  message_id      INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT          NOT NULL,
  sender_type     ENUM('customer', 'admin') NOT NULL,
  sender_id       INT          NOT NULL,  -- user_id of sender
  sender_name     VARCHAR(100) NOT NULL,
  text            TEXT         NOT NULL,
  is_read         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES customer_conversations(conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
);

ALTER TABLE customer_messages
  ADD INDEX IF NOT EXISTS idx_customer_messages_conversation (conversation_id),
  ADD INDEX IF NOT EXISTS idx_customer_messages_sender (sender_type, sender_id),
  ADD INDEX IF NOT EXISTS idx_customer_messages_created (created_at);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================