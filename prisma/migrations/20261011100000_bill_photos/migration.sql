-- An entry can have several bill photos. The single photo each entry had is carried over.
ALTER TABLE "MoneyEntry" ADD COLUMN "billIds" UUID[] DEFAULT ARRAY[]::UUID[];
UPDATE "MoneyEntry" SET "billIds" = ARRAY["billId"] WHERE "billId" IS NOT NULL;
ALTER TABLE "MoneyEntry" DROP COLUMN "billId";
