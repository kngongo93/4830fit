/**
 * The math behind progressive overload. No database access here so it can
 * run on the client (live e1RM preview while typing) and on the server
 * (PR detection on save) from the same source.
 */

export const LB_PER_KG = 2.2046226218;

export function toDisplayWeight(lb: number | null, units: "lb" | "kg"): number | null {
  if (lb == null) return null;
  return units === "kg" ? round(lb / LB_PER_KG, 1) : round(lb, 1);
}

export function toStoredWeight(value: number | null, units: "lb" | "kg"): number | null {
  if (value == null) return null;
  return units === "kg" ? round(value * LB_PER_KG, 3) : round(value, 3);
}

function round(n: number, places: number) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Epley estimated 1RM. Chosen over Brzycki because it stays sane above ~10
 * reps, which matters for accessory work. A single at any weight is that
 * weight, so the formula must not inflate 1-rep sets.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return round(weight, 1);
  return round(weight * (1 + reps / 30), 1);
}

/** Weight that should let you hit `reps` given a known e1RM. Inverse of Epley. */
export function weightForReps(e1rm: number, reps: number): number {
  if (reps <= 1) return round(e1rm, 1);
  return round(e1rm / (1 + reps / 30), 1);
}

export type LoggedSet = {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
};

export type Suggestion = {
  weight: number | null;
  reps: number | null;
  reason: string;
};

/**
 * What to do this week given last week's top set.
 *
 * RPE is the signal when it is there: a set that felt easy (<=7) earns a
 * jump, a grinder (>=9.5) repeats. Without RPE we fall back to "did you
 * hit the top of the rep range", which is the standard double-progression
 * rule and works fine on its own.
 */
export function suggestNext(
  lastSets: LoggedSet[],
  opts: { targetReps?: number; increment?: number; equipment?: string } = {},
): Suggestion {
  const working = lastSets.filter((s) => !s.isWarmup && s.weight != null && s.reps != null);
  if (working.length === 0) {
    return { weight: null, reps: null, reason: "First time logging this one" };
  }

  // Top set = heaviest; ties broken by reps.
  const top = working.reduce((best, s) =>
    s.weight! > best.weight! || (s.weight === best.weight && s.reps! > best.reps!) ? s : best,
  );

  const increment = opts.increment ?? defaultIncrement(opts.equipment);
  const targetReps = opts.targetReps ?? top.reps!;
  const hitTarget = top.reps! >= targetReps;

  if (top.rpe != null) {
    if (top.rpe <= 7) {
      return {
        weight: round(top.weight! + increment * 2, 1),
        reps: targetReps,
        reason: `Last set felt easy (RPE ${top.rpe}) - jump ${increment * 2}`,
      };
    }
    if (top.rpe >= 9.5) {
      return {
        weight: top.weight,
        reps: targetReps,
        reason: `Last set was a grinder (RPE ${top.rpe}) - repeat the weight`,
      };
    }
    if (top.rpe >= 8.5) {
      return {
        weight: top.weight,
        reps: top.reps! + 1,
        reason: `RPE ${top.rpe} - add a rep before adding weight`,
      };
    }
  }

  if (hitTarget) {
    return {
      weight: round(top.weight! + increment, 1),
      reps: targetReps,
      reason: `Hit ${top.reps} last time - add ${increment}`,
    };
  }

  return {
    weight: top.weight,
    reps: targetReps,
    reason: `Missed the target last time (${top.reps}/${targetReps}) - repeat`,
  };
}

/** Smallest sane jump per equipment type, in lb. */
export function defaultIncrement(equipment?: string): number {
  switch (equipment) {
    case "dumbbell":
      return 5; // pairs go up in 5s
    case "machine":
    case "cable":
      return 10; // stack pins
    case "barbell":
    default:
      return 5;
  }
}

export function totalVolume(sets: LoggedSet[]): number {
  return sets
    .filter((s) => !s.isWarmup)
    .reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

/** Barbell plate math: which plates per side for a target, given a bar. */
export function platesFor(target: number, barWeight = 45, available = [45, 35, 25, 10, 5, 2.5]) {
  let perSide = (target - barWeight) / 2;
  if (perSide < 0) return { plates: [] as number[], achievable: barWeight, exact: false };

  const plates: number[] = [];
  for (const plate of available) {
    while (perSide >= plate - 1e-9) {
      plates.push(plate);
      perSide = round(perSide - plate, 3);
    }
  }
  const achievable = round(target - perSide * 2, 2);
  return { plates, achievable, exact: perSide < 1e-9 };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
