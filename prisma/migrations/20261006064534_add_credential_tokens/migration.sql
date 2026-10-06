-- AlterTable
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;

-- Backfill: every existing account was vouched for by a human out of band. Only self-serve
-- researcher signup (added separately) starts unverified; without this, the new authorize()
-- check that blocks unverified researchers would refuse every researcher already in the database.
UPDATE `users` SET `emailVerifiedAt` = NOW() WHERE `emailVerifiedAt` IS NULL;

-- CreateTable
CREATE TABLE `credential_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('EMAIL_VERIFICATION', 'ACCOUNT_INVITE', 'PASSWORD_RESET') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `credential_tokens_tokenHash_key`(`tokenHash`),
    INDEX `credential_tokens_userId_purpose_idx`(`userId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credential_tokens` ADD CONSTRAINT `credential_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
