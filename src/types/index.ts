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
  device: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_id: number;
  exercise_id: number;
  set_index: number;
  reps: number | null;
  weight: number | null;
  completed_at: string | null;
  block_order: number | null;
}

// For display: groups sets by exercise within a workout
export interface ExerciseBlock {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSets: WorkoutSet[]; // from previous workout with this exercise
}

export interface WorkoutTimer {
  id: number;
  workout_id: number;
  last_action: 'START' | 'STOP' | 'LAP' | 'RESET';
  is_running: number; // 0 tai 1
  total_elapsed_ms: number;
  lap_elapsed_ms: number;
  updated_at: string;
}
