-- Apply ONLY to the dedicated fresh nodeust_email_* database after base migrations.
CREATE TABLE email_accounts (
 id varchar(36) PRIMARY KEY,
 email varchar(191) NOT NULL,
 password_hash varchar(255) NOT NULL,
 user_id varchar(36) NULL,
 verified_at datetime(3) NULL,
 created_at datetime(3) NOT NULL,
 updated_at datetime(3) NOT NULL,
 UNIQUE KEY email_accounts_email (email),
 UNIQUE KEY email_accounts_user (user_id),
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE email_tokens (
 token_hash char(64) PRIMARY KEY,
 account_id varchar(36) NOT NULL,
 purpose enum('verify','reset') NOT NULL,
 expires_at datetime(3) NOT NULL,
 created_at datetime(3) NOT NULL,
 UNIQUE KEY email_token_purpose (account_id,purpose),
 KEY email_token_expiry (expires_at),
 FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
);
CREATE TABLE email_sessions (
 token_hash char(64) PRIMARY KEY,
 account_id varchar(36) NOT NULL,
 expires_at datetime(3) NOT NULL,
 created_at datetime(3) NOT NULL,
 KEY email_session_account (account_id),
 KEY email_session_expiry (expires_at),
 FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
);
CREATE TABLE email_rate_limits (
 bucket_hash char(64) PRIMARY KEY,
 hits int unsigned NOT NULL,
 expires_at datetime(3) NOT NULL,
 KEY email_rate_expiry (expires_at)
);
