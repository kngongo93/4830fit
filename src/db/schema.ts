import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------------------------------------------------------------- enums */

export const roleEnum = pgEnum("role", ["admin", "member"]);
export const unitEnum = pgEnum("unit", ["lb", "kg"]);

/** Decides which fields the logger shows for an exercise. */
export const modalityEnum = pgEnum("modality", [
  "weight_reps", // barbell bench: weight x reps
  "bodyweight", // pushups: reps only
  "weighted_bodyweight", // weighted pullups: added weight x reps
  "cardio", // run/row/bike: duration + distance + calories
  "time", // plank/carry: duration only
]);

export const prTypeEnum = pgEnum("pr_type", [
  "heaviest_weight", // heaviest single working set
  "best_e1rm", // best estimated 1RM
  "best_volume", // best weight*reps in one set
  "best_reps", // most reps at any weight (bodyweight lifts)
  "best_distance", // cardio
  "best_duration", // cardio / time
]);

/** Who can see a routine. Training data itself is always private-by-default. */
export const visibilityEnum = pgEnum("visibility", ["private", "crew"]);

/* ---------------------------------------------------------------- users */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("member"),
    units: unitEnum("units").notNull().default("lb"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** Server-side sessions. The cookie holds a token; we store only its hash. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/** Invite-only signup. Admin mints a code, hands out the link. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"), // "Marcus", "Tuesday crew" - a reminder for the admin
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invites_code_idx").on(t.code)],
);

/* -------------------------------------------------------------- sharing */

/**
 * The whole privacy model lives here. Nothing is readable across users
 * unless a row in this table says so.
 *
 * One-way and explicit: the owner grants a viewer read access to the
 * owner's training log. It does NOT grant the reverse - two people who
 * want to see each other need two rows. The owner can revoke any time,
 * and revoking is immediate because every read checks this table.
 */
export const accessGrants = pgTable(
  "access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("access_grants_pair_idx").on(t.ownerId, t.viewerId),
    index("access_grants_viewer_idx").on(t.viewerId),
  ],
);

/* ------------------------------------------------------------ exercises */

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group").notNull(), // chest, back, quads, ...
    equipment: text("equipment").notNull(), // barbell, dumbbell, machine, cable, bodyweight, other
    modality: modalityEnum("modality").notNull().default("weight_reps"),
    /** null = built-in library exercise, visible to everyone. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exercises_owner_idx").on(t.ownerId), index("exercises_name_idx").on(t.name)],
);

/* ------------------------------------------------------------- routines */

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "PPL 6-day"
    description: text("description"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routines_owner_idx").on(t.ownerId)],
);

/**
 * A training day within a program: "Monday", "Push A".
 *
 * weekday is 0-6 (Sunday first) when the day is pinned to a day of the
 * week, and null for programs that are just an ordered rotation.
 */
export const routineDays = pgTable(
  "routine_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    weekday: integer("weekday"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("routine_days_routine_idx").on(t.routineId)],
);

/**
 * A named section within a day - "Block A: chest and triceps", "Block B:
 * cardio". A day is a list of blocks, and each block is a list of
 * exercises, which is how a written program actually reads.
 */
export const routineBlocks = pgTable(
  "routine_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineDayId: uuid("routine_day_id")
      .notNull()
      .references(() => routineDays.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Block A"
    focus: text("focus"), // "chest and triceps"
    note: text("note"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("routine_blocks_day_idx").on(t.routineDayId)],
);

export const routineItems = pgTable(
  "routine_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => routineBlocks.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    targetSets: integer("target_sets").notNull().default(3),
    targetReps: text("target_reps").notNull().default("8"), // "5" or "8-12"
    targetRpe: real("target_rpe"),
    notes: text("notes"),
  },
  (t) => [index("routine_items_block_idx").on(t.blockId)],
);

/**
 * Who is running a program. The author keeps ownerId on the routine; every
 * athlete it has been handed to gets a row here.
 *
 * An assignee can edit what they were given - the programming is a starting
 * point, not a contract, so swapping an exercise or changing a rep target
 * does not require going back to whoever wrote it.
 */
export const routineAssignments = pgTable(
  "routine_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("routine_assignments_pair_idx").on(t.routineId, t.userId),
    index("routine_assignments_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------- workouts */

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** null when it is a freeform session not tied to a routine. */
    routineDayId: uuid("routine_day_id").references(() => routineDays.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull().default("Workout"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [index("workouts_user_started_idx").on(t.userId, t.startedAt)],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    /**
     * Snapshot of the block this came from, copied rather than referenced.
     * A session should still read the way it was performed even after the
     * program that produced it is edited or deleted.
     */
    blockName: text("block_name"),
    notes: text("notes"),
  },
  (t) => [
    index("workout_exercises_workout_idx").on(t.workoutId),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

/**
 * One row per set. Lifting and cardio share this table; the exercise
 * modality decides which columns the UI collects and displays.
 *
 * Weight is always stored in lb and converted at the edges, so a user
 * flipping their unit preference never rewrites history.
 */
export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    isWarmup: boolean("is_warmup").notNull().default(false),

    // lifting
    weight: real("weight"),
    reps: integer("reps"),
    rpe: real("rpe"), // 1-10, half steps

    // cardio / time
    durationSec: integer("duration_sec"),
    distanceM: real("distance_m"),
    calories: integer("calories"),

    note: text("note"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sets_workout_exercise_idx").on(t.workoutExerciseId)],
);

/**
 * Current best per (user, exercise, type). Updated on save when beaten,
 * so the PR screen is a cheap indexed read instead of a scan over every
 * set the user has ever logged.
 */
export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    type: prTypeEnum("type").notNull(),
    value: real("value").notNull(), // the comparable number for this type
    weight: real("weight"),
    reps: integer("reps"),
    setId: uuid("set_id").references(() => sets.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "cascade" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("prs_user_exercise_type_idx").on(t.userId, t.exerciseId, t.type)],
);

/* ------------------------------------------------------------ relations */

export const usersRelations = relations(users, ({ many }) => ({
  workouts: many(workouts),
  routines: many(routines),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, { fields: [workouts.userId], references: [users.id] }),
  routineDay: one(routineDays, {
    fields: [workouts.routineDayId],
    references: [routineDays.id],
  }),
  entries: many(workoutExercises),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
  exercise: one(exercises, {
    fields: [workoutExercises.exerciseId],
    references: [exercises.id],
  }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  entry: one(workoutExercises, {
    fields: [sets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  owner: one(users, { fields: [routines.ownerId], references: [users.id] }),
  days: many(routineDays),
}));

export const routineDaysRelations = relations(routineDays, ({ one, many }) => ({
  routine: one(routines, { fields: [routineDays.routineId], references: [routines.id] }),
  blocks: many(routineBlocks),
}));

export const routineBlocksRelations = relations(routineBlocks, ({ one, many }) => ({
  day: one(routineDays, {
    fields: [routineBlocks.routineDayId],
    references: [routineDays.id],
  }),
  items: many(routineItems),
}));

export const routineItemsRelations = relations(routineItems, ({ one }) => ({
  block: one(routineBlocks, {
    fields: [routineItems.blockId],
    references: [routineBlocks.id],
  }),
  exercise: one(exercises, { fields: [routineItems.exerciseId], references: [exercises.id] }),
}));

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
