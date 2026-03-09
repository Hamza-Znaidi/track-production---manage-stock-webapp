-- Add optional stock code for category-based unique IDs
ALTER TABLE "StockItem"
ADD COLUMN "code" TEXT;

-- Add QR image/data URL storage on work orders
ALTER TABLE "WorkOrder"
ADD COLUMN "qrCode" TEXT;

-- Per-category sequence tracker for stock item code generation
CREATE TABLE "StockCodeCounter" (
    "id" SERIAL NOT NULL,
    "category" "StockCategory" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCodeCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockItem_code_key" ON "StockItem"("code");
CREATE UNIQUE INDEX "StockCodeCounter_category_key" ON "StockCodeCounter"("category");
