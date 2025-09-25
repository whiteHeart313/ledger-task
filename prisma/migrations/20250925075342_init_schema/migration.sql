-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `kyc_status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `idx_email`(`email`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `account_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `account_number` VARCHAR(50) NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `account_type_id` INTEGER UNSIGNED NOT NULL,
    `currency_code` CHAR(3) NOT NULL DEFAULT 'USD',
    `balance` BIGINT NOT NULL DEFAULT 0,
    `available_balance` BIGINT NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `daily_limit` BIGINT NULL,
    `monthly_limit` BIGINT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `accounts_account_number_key`(`account_number`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_account_number`(`account_number`),
    INDEX `idx_status_currency`(`status`, `currency_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `transaction_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `reference_number` VARCHAR(100) NOT NULL,
    `external_reference` VARCHAR(255) NULL,
    `transaction_type_id` INTEGER UNSIGNED NOT NULL,
    `amount` BIGINT NOT NULL,
    `currency_code` CHAR(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `from_account_id` BIGINT UNSIGNED NULL,
    `to_account_id` BIGINT UNSIGNED NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `initiated_by` BIGINT UNSIGNED NULL,
    `initiated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `completed_at` TIMESTAMP(0) NULL,
    `failed_at` TIMESTAMP(0) NULL,
    `failure_reason` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `transactions_idempotency_key_key`(`idempotency_key`),
    UNIQUE INDEX `transactions_reference_number_key`(`reference_number`),
    INDEX `idx_idempotency_key`(`idempotency_key`),
    INDEX `idx_reference_number`(`reference_number`),
    INDEX `idx_external_reference`(`external_reference`),
    INDEX `idx_from_account`(`from_account_id`),
    INDEX `idx_to_account`(`to_account_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_initiated_by`(`initiated_by`),
    INDEX `idx_currency_status`(`currency_code`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transaction_id` BIGINT UNSIGNED NOT NULL,
    `account_id` BIGINT UNSIGNED NOT NULL,
    `entry_type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `amount` BIGINT NOT NULL,
    `currency_code` CHAR(3) NOT NULL,
    `balance_after` BIGINT NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_transaction_id`(`transaction_id`),
    INDEX `idx_account_id`(`account_id`),
    INDEX `idx_account_created`(`account_id`, `created_at`),
    INDEX `idx_entry_type`(`entry_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_account_type_id_fkey` FOREIGN KEY (`account_type_id`) REFERENCES `account_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_transaction_type_id_fkey` FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_from_account_id_fkey` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_to_account_id_fkey` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
