-- CreateTable
CREATE TABLE "WorkOrderStageNote" (
    "id" SERIAL NOT NULL,
    "stageId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderStageNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderStageNote_stageId_createdAt_idx" ON "WorkOrderStageNote"("stageId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrderStageNote_createdAt_idx" ON "WorkOrderStageNote"("createdAt");

-- AddForeignKey
ALTER TABLE "WorkOrderStageNote" ADD CONSTRAINT "WorkOrderStageNote_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkOrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStageNote" ADD CONSTRAINT "WorkOrderStageNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
