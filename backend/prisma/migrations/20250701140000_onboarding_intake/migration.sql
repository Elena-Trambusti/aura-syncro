-- Onboarding proprietario: intake JSON + appuntamenti setup (sostituto Calendly)

ALTER TABLE "RestaurantSettings" ADD COLUMN "onboardingIntake" JSONB;
ALTER TABLE "RestaurantSettings" ADD COLUMN "onboardingSubmittedAt" TIMESTAMP(3);

CREATE TYPE "SetupAppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "SetupAppointment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "status" "SetupAppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupAppointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SetupAppointment_restaurantId_key" ON "SetupAppointment"("restaurantId");
CREATE UNIQUE INDEX "SetupAppointment_slotStart_key" ON "SetupAppointment"("slotStart");
CREATE INDEX "SetupAppointment_slotStart_status_idx" ON "SetupAppointment"("slotStart", "status");

ALTER TABLE "SetupAppointment" ADD CONSTRAINT "SetupAppointment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
