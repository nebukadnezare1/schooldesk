-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NumberSequence_schoolId_idx" ON "NumberSequence"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_schoolId_series_key" ON "NumberSequence"("schoolId", "series");

-- AddForeignKey
ALTER TABLE "NumberSequence" ADD CONSTRAINT "NumberSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
