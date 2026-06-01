-- Add updatedAt column to WorkOrderStageNote
ALTER TABLE "WorkOrderStageNote" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Set existing records' updatedAt to match their createdAt
UPDATE "WorkOrderStageNote" SET "updatedAt" = "createdAt";
