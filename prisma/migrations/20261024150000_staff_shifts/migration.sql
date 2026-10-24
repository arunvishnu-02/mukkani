-- ID card and uniform / dress code become Yes / No / Don't have.
ALTER TABLE "StaffDay" ALTER COLUMN "idCard" TYPE TEXT USING CASE WHEN "idCard" IS TRUE THEN 'YES' WHEN "idCard" IS FALSE THEN 'NO' END;
ALTER TABLE "StaffDay" ALTER COLUMN "uniform" TYPE TEXT USING CASE WHEN "uniform" IS TRUE THEN 'YES' WHEN "uniform" IS FALSE THEN 'NO' END;

-- Present or absent, and the kitchen's second shift.
ALTER TABLE "StaffDay" ADD COLUMN "attendance" TEXT,
ADD COLUMN "inTime2" TEXT,
ADD COLUMN "outTime2" TEXT;

-- Every record before this change was a day the person came.
UPDATE "StaffDay" SET "attendance" = 'PRESENT' WHERE "attendance" IS NULL;
