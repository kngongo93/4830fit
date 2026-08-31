/**
 * The built-in exercise library. These are seeded with ownerId = null,
 * which makes them visible to every user. Anything a user adds themselves
 * gets their own ownerId and stays private to them.
 *
 * Modality drives the logger UI:
 *   weight_reps         weight x reps
 *   bodyweight          reps only
 *   weighted_bodyweight optional added weight x reps
 *   cardio              duration + distance + calories
 *   time                duration only
 */

export type SeedExercise = {
  name: string;
  muscleGroup: string;
  equipment: string;
  modality: "weight_reps" | "bodyweight" | "weighted_bodyweight" | "cardio" | "time";
};

const w = (name: string, muscleGroup: string, equipment: string): SeedExercise => ({
  name,
  muscleGroup,
  equipment,
  modality: "weight_reps",
});

const bw = (name: string, muscleGroup: string): SeedExercise => ({
  name,
  muscleGroup,
  equipment: "bodyweight",
  modality: "bodyweight",
});

const wbw = (name: string, muscleGroup: string): SeedExercise => ({
  name,
  muscleGroup,
  equipment: "bodyweight",
  modality: "weighted_bodyweight",
});

const cardio = (name: string, equipment: string): SeedExercise => ({
  name,
  muscleGroup: "cardio",
  equipment,
  modality: "cardio",
});

const timed = (name: string, muscleGroup: string, equipment: string): SeedExercise => ({
  name,
  muscleGroup,
  equipment,
  modality: "time",
});

export const EXERCISE_LIBRARY: SeedExercise[] = [
  /* ------------------------------------------------------------- chest */
  w("Barbell Bench Press", "chest", "barbell"),
  w("Incline Barbell Bench Press", "chest", "barbell"),
  w("Decline Barbell Bench Press", "chest", "barbell"),
  w("Close-Grip Bench Press", "triceps", "barbell"),
  w("Dumbbell Bench Press", "chest", "dumbbell"),
  w("Incline Dumbbell Press", "chest", "dumbbell"),
  w("Decline Dumbbell Press", "chest", "dumbbell"),
  w("Dumbbell Fly", "chest", "dumbbell"),
  w("Incline Dumbbell Fly", "chest", "dumbbell"),
  w("Cable Fly", "chest", "cable"),
  w("Low-to-High Cable Fly", "chest", "cable"),
  w("High-to-Low Cable Fly", "chest", "cable"),
  w("Machine Chest Press", "chest", "machine"),
  w("Pec Deck", "chest", "machine"),
  w("Smith Machine Bench Press", "chest", "machine"),
  wbw("Push-Up", "chest"),
  wbw("Deficit Push-Up", "chest"),
  wbw("Chest Dip", "chest"),

  /* -------------------------------------------------------------- back */
  w("Conventional Deadlift", "back", "barbell"),
  w("Sumo Deadlift", "back", "barbell"),
  w("Romanian Deadlift", "hamstrings", "barbell"),
  w("Deficit Deadlift", "back", "barbell"),
  w("Rack Pull", "back", "barbell"),
  w("Barbell Row", "back", "barbell"),
  w("Pendlay Row", "back", "barbell"),
  w("T-Bar Row", "back", "barbell"),
  w("Meadows Row", "back", "barbell"),
  w("Dumbbell Row", "back", "dumbbell"),
  w("Chest-Supported Dumbbell Row", "back", "dumbbell"),
  w("Seated Cable Row", "back", "cable"),
  w("Single-Arm Cable Row", "back", "cable"),
  w("Lat Pulldown", "back", "cable"),
  w("Close-Grip Lat Pulldown", "back", "cable"),
  w("Straight-Arm Pulldown", "back", "cable"),
  w("Machine Row", "back", "machine"),
  w("Machine Pullover", "back", "machine"),
  w("Barbell Shrug", "traps", "barbell"),
  w("Dumbbell Shrug", "traps", "dumbbell"),
  w("Face Pull", "rear delts", "cable"),
  wbw("Pull-Up", "back"),
  wbw("Chin-Up", "back"),
  wbw("Neutral-Grip Pull-Up", "back"),
  bw("Inverted Row", "back"),
  w("Back Extension", "lower back", "bodyweight"),
  w("Good Morning", "lower back", "barbell"),

  /* ---------------------------------------------------------- shoulders */
  w("Overhead Press", "shoulders", "barbell"),
  w("Push Press", "shoulders", "barbell"),
  w("Seated Barbell Press", "shoulders", "barbell"),
  w("Dumbbell Shoulder Press", "shoulders", "dumbbell"),
  w("Arnold Press", "shoulders", "dumbbell"),
  w("Lateral Raise", "side delts", "dumbbell"),
  w("Cable Lateral Raise", "side delts", "cable"),
  w("Machine Lateral Raise", "side delts", "machine"),
  w("Front Raise", "front delts", "dumbbell"),
  w("Rear Delt Fly", "rear delts", "dumbbell"),
  w("Reverse Pec Deck", "rear delts", "machine"),
  w("Upright Row", "shoulders", "barbell"),
  w("Landmine Press", "shoulders", "barbell"),
  wbw("Pike Push-Up", "shoulders"),

  /* ------------------------------------------------------------ biceps */
  w("Barbell Curl", "biceps", "barbell"),
  w("EZ-Bar Curl", "biceps", "barbell"),
  w("Dumbbell Curl", "biceps", "dumbbell"),
  w("Alternating Dumbbell Curl", "biceps", "dumbbell"),
  w("Hammer Curl", "biceps", "dumbbell"),
  w("Incline Dumbbell Curl", "biceps", "dumbbell"),
  w("Preacher Curl", "biceps", "barbell"),
  w("Concentration Curl", "biceps", "dumbbell"),
  w("Cable Curl", "biceps", "cable"),
  w("Bayesian Cable Curl", "biceps", "cable"),
  w("Spider Curl", "biceps", "dumbbell"),
  w("Reverse Curl", "forearms", "barbell"),

  /* ----------------------------------------------------------- triceps */
  w("Triceps Pushdown", "triceps", "cable"),
  w("Rope Pushdown", "triceps", "cable"),
  w("Overhead Cable Extension", "triceps", "cable"),
  w("Skullcrusher", "triceps", "barbell"),
  w("Dumbbell Overhead Extension", "triceps", "dumbbell"),
  w("Dumbbell Kickback", "triceps", "dumbbell"),
  w("JM Press", "triceps", "barbell"),
  wbw("Triceps Dip", "triceps"),
  bw("Bench Dip", "triceps"),

  /* ------------------------------------------------------------- quads */
  w("Back Squat", "quads", "barbell"),
  w("Front Squat", "quads", "barbell"),
  w("High-Bar Squat", "quads", "barbell"),
  w("Low-Bar Squat", "quads", "barbell"),
  w("Pause Squat", "quads", "barbell"),
  w("Box Squat", "quads", "barbell"),
  w("Safety Bar Squat", "quads", "barbell"),
  w("Smith Machine Squat", "quads", "machine"),
  w("Hack Squat", "quads", "machine"),
  w("Leg Press", "quads", "machine"),
  w("Leg Extension", "quads", "machine"),
  w("Goblet Squat", "quads", "dumbbell"),
  w("Bulgarian Split Squat", "quads", "dumbbell"),
  w("Walking Lunge", "quads", "dumbbell"),
  w("Reverse Lunge", "quads", "dumbbell"),
  w("Step-Up", "quads", "dumbbell"),
  w("Sissy Squat", "quads", "bodyweight"),
  wbw("Bodyweight Squat", "quads"),

  /* -------------------------------------------------------- hamstrings */
  w("Lying Leg Curl", "hamstrings", "machine"),
  w("Seated Leg Curl", "hamstrings", "machine"),
  w("Stiff-Leg Deadlift", "hamstrings", "barbell"),
  w("Dumbbell Romanian Deadlift", "hamstrings", "dumbbell"),
  w("Single-Leg Romanian Deadlift", "hamstrings", "dumbbell"),
  w("Glute-Ham Raise", "hamstrings", "bodyweight"),
  bw("Nordic Curl", "hamstrings"),

  /* ------------------------------------------------------------ glutes */
  w("Hip Thrust", "glutes", "barbell"),
  w("Glute Bridge", "glutes", "barbell"),
  w("Single-Leg Hip Thrust", "glutes", "bodyweight"),
  w("Cable Kickback", "glutes", "cable"),
  w("Hip Abduction Machine", "glutes", "machine"),
  w("Hip Adduction Machine", "adductors", "machine"),

  /* ------------------------------------------------------------ calves */
  w("Standing Calf Raise", "calves", "machine"),
  w("Seated Calf Raise", "calves", "machine"),
  w("Leg Press Calf Raise", "calves", "machine"),
  w("Dumbbell Calf Raise", "calves", "dumbbell"),

  /* ---------------------------------------------------------- forearms */
  w("Wrist Curl", "forearms", "barbell"),
  w("Reverse Wrist Curl", "forearms", "barbell"),
  timed("Farmer Carry", "forearms", "dumbbell"),
  timed("Dead Hang", "forearms", "bodyweight"),

  /* --------------------------------------------------------------- abs */
  bw("Crunch", "abs"),
  bw("Sit-Up", "abs"),
  bw("Hanging Leg Raise", "abs"),
  bw("Hanging Knee Raise", "abs"),
  bw("Bicycle Crunch", "abs"),
  bw("V-Up", "abs"),
  bw("Mountain Climber", "abs"),
  w("Cable Crunch", "abs", "cable"),
  w("Machine Crunch", "abs", "machine"),
  w("Weighted Decline Sit-Up", "abs", "dumbbell"),
  w("Pallof Press", "abs", "cable"),
  w("Russian Twist", "obliques", "dumbbell"),
  w("Cable Woodchop", "obliques", "cable"),
  timed("Plank", "abs", "bodyweight"),
  timed("Side Plank", "obliques", "bodyweight"),
  timed("Hollow Body Hold", "abs", "bodyweight"),
  timed("Ab Wheel Rollout", "abs", "other"),

  /* ------------------------------------------------------------ cardio */
  cardio("Treadmill Run", "treadmill"),
  cardio("Outdoor Run", "other"),
  cardio("Incline Treadmill Walk", "treadmill"),
  cardio("Rowing Machine", "rower"),
  cardio("Stationary Bike", "bike"),
  cardio("Outdoor Cycling", "other"),
  cardio("Elliptical", "machine"),
  cardio("Stair Climber", "machine"),
  cardio("Assault Bike", "bike"),
  cardio("SkiErg", "machine"),
  cardio("Swimming", "other"),
  cardio("Jump Rope", "other"),
  cardio("Sled Push", "other"),
  cardio("Sled Drag", "other"),
  cardio("Ruck", "other"),

  /* --------------------------------------------------- olympic / other */
  w("Power Clean", "full body", "barbell"),
  w("Hang Clean", "full body", "barbell"),
  w("Clean and Jerk", "full body", "barbell"),
  w("Snatch", "full body", "barbell"),
  w("High Pull", "full body", "barbell"),
  w("Kettlebell Swing", "full body", "other"),
  w("Turkish Get-Up", "full body", "other"),
  wbw("Burpee", "full body"),
  bw("Box Jump", "quads"),
];
