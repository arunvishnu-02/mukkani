-- Delivery login (6 Nov 2026): delivery role, delivery person per region, daily rounds, time of each delivery.
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'SALES', 'KITCHEN', 'DELIVERY') NOT NULL;

ALTER TABLE `Region` ADD COLUMN `deliveryUserId` VARCHAR(191) NULL;
ALTER TABLE `Region` ADD CONSTRAINT `Region_deliveryUserId_fkey` FOREIGN KEY (`deliveryUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attendance` ADD COLUMN `deliveredAt` DATETIME(3) NULL;

CREATE TABLE `DeliveryRound` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `loginAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `done` INTEGER NOT NULL DEFAULT 0,
    `missed` INTEGER NOT NULL DEFAULT 0,
    `total` INTEGER NOT NULL DEFAULT 0,
    `lastLat` DOUBLE NULL,
    `lastLng` DOUBLE NULL,
    `lastAt` DATETIME(3) NULL,

    INDEX `DeliveryRound_date_idx`(`date`),
    UNIQUE INDEX `DeliveryRound_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeliveryRound` ADD CONSTRAINT `DeliveryRound_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
