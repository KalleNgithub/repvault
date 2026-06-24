export interface Exercise {
  id: number;
  name: string;
  created_at: string;
}

export interface Workout {
  id: number;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_id: number;
  exercise_id: number;
  set_index: number;
  reps: number | null;
  weight: number | null;
  completed_at: string | null;
}

// For display: groups sets by exercise within a workout
export interface ExerciseBlock {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSets: WorkoutSet[]; // from previous workout with this exercise
}
