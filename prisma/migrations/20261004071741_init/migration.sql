-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SALES', 'KITCHEN') NOT NULL,
    `phone` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `ownerId` VARCHAR(191) NULL,

    UNIQUE INDEX `Region_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `altPhone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `source` ENUM('CALL', 'WHATSAPP', 'REFERRAL', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'WALK_IN') NOT NULL DEFAULT 'CALL',
    `status` ENUM('NEW', 'CONTACTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'TRIAL_REQUESTED', 'TRIAL_ACTIVE', 'CONVERTED', 'LOST') NOT NULL DEFAULT 'NEW',
    `notes` TEXT NULL,
    `foodNotes` TEXT NULL,
    `slot` VARCHAR(191) NULL,
    `regionId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `nextFollowUpAt` DATE NULL,
    `locationStatus` ENUM('MISSING', 'LINK_SENT', 'PIN_SAVED') NOT NULL DEFAULT 'MISSING',
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `accuracyM` INTEGER NULL,
    `locationUpdatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_status_idx`(`status`),
    INDEX `Lead_nextFollowUpAt_idx`(`nextFollowUpAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUp` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrialBox` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('PENDING', 'ASSIGNED', 'PREPARING', 'DELIVERED', 'TRIAL_ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `result` ENUM('CONVERTED', 'NOT_CONVERTED') NULL,
    `notes` TEXT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrialBox_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `packageType` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL DEFAULT 3430,
    `startDate` DATE NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Package_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LocationRequest` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `sharedAt` DATETIME(3) NULL,

    UNIQUE INDEX `LocationRequest_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `detail` TEXT NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Activity_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `Activity_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Region` ADD CONSTRAINT `Region_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_byId_fkey` FOREIGN KEY (`byId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrialBox` ADD CONSTRAINT `TrialBox_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrialBox` ADD CONSTRAINT `TrialBox_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Package` ADD CONSTRAINT `Package_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationRequest` ADD CONSTRAINT `LocationRequest_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_byId_fkey` FOREIGN KEY (`byId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
