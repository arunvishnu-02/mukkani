-- V2 (plan doc 10 Oct 2026). Existing data is carried over:
-- lead statuses become the 4 categories, trial boxes become one-date trials,
-- paused packages become active packages on a paused customer.

-- Lead: new fields
ALTER TABLE `Lead` ADD COLUMN `customerStatus` ENUM('ACTIVE', 'PAUSED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `deliveryTime` VARCHAR(191) NULL,
    ADD COLUMN `dob` DATE NULL,
    ADD COLUMN `healthNotes` TEXT NULL,
    ADD COLUMN `notInterestedReason` VARCHAR(191) NULL,
    ADD COLUMN `pausedUntil` DATE NULL;
ALTER TABLE `Lead` CHANGE `foodNotes` `avoidFoods` TEXT NULL;

-- Lead source: Instagram becomes Insta DM, sources no longer used become Other
ALTER TABLE `Lead` MODIFY `source` ENUM('CALL', 'WHATSAPP', 'REFERRAL', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'WALK_IN', 'INSTA_DM', 'INSTA_COMMENT', 'GBM', 'OTHER') NOT NULL DEFAULT 'CALL';
UPDATE `Lead` SET `source` = 'INSTA_DM' WHERE `source` = 'INSTAGRAM';
UPDATE `Lead` SET `source` = 'OTHER' WHERE `source` IN ('REFERRAL', 'WEBSITE', 'FACEBOOK', 'WALK_IN');
ALTER TABLE `Lead` MODIFY `source` ENUM('WHATSAPP', 'INSTA_DM', 'INSTA_COMMENT', 'GBM', 'CALL', 'OTHER') NOT NULL DEFAULT 'CALL';

-- Lead status: 8 statuses become the 4 categories
ALTER TABLE `Lead` MODIFY `status` ENUM('NEW', 'CONTACTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'TRIAL_REQUESTED', 'TRIAL_ACTIVE', 'CONVERTED', 'LOST', 'TRIAL', 'MONTHLY') NOT NULL DEFAULT 'FOLLOW_UP';
UPDATE `Lead` SET `status` = 'FOLLOW_UP' WHERE `status` IN ('NEW', 'CONTACTED');
UPDATE `Lead` SET `status` = 'TRIAL' WHERE `status` IN ('TRIAL_REQUESTED', 'TRIAL_ACTIVE');
UPDATE `Lead` SET `status` = 'MONTHLY' WHERE `status` = 'CONVERTED';
UPDATE `Lead` SET `status` = 'NOT_INTERESTED' WHERE `status` = 'LOST';
ALTER TABLE `Lead` MODIFY `status` ENUM('FOLLOW_UP', 'TRIAL', 'MONTHLY', 'NOT_INTERESTED') NOT NULL DEFAULT 'FOLLOW_UP';

-- Package: new fields; a paused package becomes an active package on a paused customer
ALTER TABLE `Package` ADD COLUMN `buttermilkPrice` INTEGER NOT NULL DEFAULT 299,
    ADD COLUMN `buttermilkQty` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `number` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `reminderSentAt` DATETIME(3) NULL,
    ADD COLUMN `reportNote` TEXT NULL,
    MODIFY `packageType` VARCHAR(191) NOT NULL DEFAULT 'Monthly package';
UPDATE `Lead` l JOIN `Package` p ON p.`leadId` = l.`id` SET l.`customerStatus` = 'PAUSED' WHERE p.`status` = 'PAUSED';
UPDATE `Package` SET `status` = 'ACTIVE' WHERE `status` = 'PAUSED';
ALTER TABLE `Package` MODIFY `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE';

-- TrialBox: one delivery date, no kitchen assignee
ALTER TABLE `TrialBox` DROP FOREIGN KEY `TrialBox_assignedToId_fkey`;
DROP INDEX `TrialBox_assignedToId_fkey` ON `TrialBox`;
ALTER TABLE `TrialBox` DROP COLUMN `assignedToId`,
    DROP COLUMN `endDate`,
    ADD COLUMN `boxNo` INTEGER NULL,
    ADD COLUMN `boxReturned` BOOLEAN NULL,
    ADD COLUMN `feedback` TEXT NULL,
    ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `price` INTEGER NOT NULL DEFAULT 200,
    ADD COLUMN `slot` VARCHAR(191) NULL;
ALTER TABLE `TrialBox` CHANGE `startDate` `deliveryDate` DATE NOT NULL;
ALTER TABLE `TrialBox` MODIFY `status` ENUM('PENDING', 'ASSIGNED', 'PREPARING', 'DELIVERED', 'TRIAL_ACTIVE', 'COMPLETED', 'BOOKED', 'DONE') NOT NULL DEFAULT 'BOOKED';
UPDATE `TrialBox` SET `status` = 'BOOKED' WHERE `status` IN ('PENDING', 'ASSIGNED', 'PREPARING');
UPDATE `TrialBox` SET `status` = 'DELIVERED' WHERE `status` = 'TRIAL_ACTIVE';
UPDATE `TrialBox` SET `status` = 'DONE' WHERE `status` = 'COMPLETED';
ALTER TABLE `TrialBox` MODIFY `status` ENUM('BOOKED', 'DELIVERED', 'DONE') NOT NULL DEFAULT 'BOOKED';
ALTER TABLE `TrialBox` MODIFY `result` ENUM('CONVERTED', 'NOT_CONVERTED', 'MONTHLY', 'FOLLOW_UP', 'NOT_INTERESTED') NULL;
UPDATE `TrialBox` SET `result` = 'MONTHLY' WHERE `result` = 'CONVERTED';
UPDATE `TrialBox` SET `result` = 'FOLLOW_UP' WHERE `result` = 'NOT_CONVERTED';
ALTER TABLE `TrialBox` MODIFY `result` ENUM('MONTHLY', 'FOLLOW_UP', 'NOT_INTERESTED') NULL;
UPDATE `TrialBox` t JOIN `Lead` l ON l.`id` = t.`leadId` SET t.`slot` = l.`slot`;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` ENUM('DELIVERED', 'ABSENT', 'NOT_DELIVERED') NOT NULL,
    `buttermilk` BOOLEAN NOT NULL DEFAULT false,
    `boxBack` BOOLEAN NULL,
    `remarks` VARCHAR(191) NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_date_idx`(`date`),
    UNIQUE INDEX `Attendance_leadId_date_key`(`leadId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AltBox` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `boxNo` INTEGER NOT NULL,
    `givenOn` DATE NOT NULL,
    `collectedOn` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AltBox_collectedOn_idx`(`collectedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerCall` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `dayNo` INTEGER NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `renewal` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomerCall_packageId_dayNo_key`(`packageId`, `dayNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Menu` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `fruits` TEXT NOT NULL,
    `salad` VARCHAR(191) NULL,
    `swapFruits` TEXT NOT NULL,
    `note` TEXT NULL,
    `byId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Menu_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockEntry` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `fruit` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `qtyKg` DOUBLE NOT NULL,
    `note` VARCHAR(191) NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockEntry_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Wastage` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `fruit` VARCHAR(191) NOT NULL,
    `cutKg` DOUBLE NOT NULL DEFAULT 0,
    `wasteKg` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Wastage_date_fruit_key`(`date`, `fruit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoneyEntry` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('PURCHASE', 'EXPENSE') NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `quantity` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `paidTo` VARCHAR(191) NULL,
    `billId` VARCHAR(191) NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MoneyEntry_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Upload` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `data` LONGBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `TrialBox_deliveryDate_idx` ON `TrialBox`(`deliveryDate`);

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AltBox` ADD CONSTRAINT `AltBox_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerCall` ADD CONSTRAINT `CustomerCall_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerCall` ADD CONSTRAINT `CustomerCall_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

