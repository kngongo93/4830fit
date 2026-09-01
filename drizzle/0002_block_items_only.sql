ALTER TABLE "routine_items" DROP CONSTRAINT "routine_items_routine_day_id_routine_days_id_fk";
--> statement-breakpoint
ALTER TABLE "routine_items" ALTER COLUMN "block_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_items" DROP COLUMN "routine_day_id";