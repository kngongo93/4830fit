CREATE TABLE "routine_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_day_id" uuid NOT NULL,
	"name" text NOT NULL,
	"focus" text,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "routine_items_day_idx";--> statement-breakpoint
ALTER TABLE "routine_items" ALTER COLUMN "routine_day_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_days" ADD COLUMN "weekday" integer;--> statement-breakpoint
ALTER TABLE "routine_items" ADD COLUMN "block_id" uuid;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "block_name" text;--> statement-breakpoint
ALTER TABLE "routine_assignments" ADD CONSTRAINT "routine_assignments_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_assignments" ADD CONSTRAINT "routine_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_assignments" ADD CONSTRAINT "routine_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_blocks" ADD CONSTRAINT "routine_blocks_routine_day_id_routine_days_id_fk" FOREIGN KEY ("routine_day_id") REFERENCES "public"."routine_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routine_assignments_pair_idx" ON "routine_assignments" USING btree ("routine_id","user_id");--> statement-breakpoint
CREATE INDEX "routine_assignments_user_idx" ON "routine_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routine_blocks_day_idx" ON "routine_blocks" USING btree ("routine_day_id");--> statement-breakpoint
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_block_id_routine_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."routine_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_items_block_idx" ON "routine_items" USING btree ("block_id");