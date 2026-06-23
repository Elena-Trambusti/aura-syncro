-- Expand Role enum for bar and host staff
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BARTENDER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOST';
