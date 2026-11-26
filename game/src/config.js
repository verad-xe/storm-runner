// Storm Runner — shared tuning constants for the flight model, the valley
// and the presentation. One place to tune the feel of the whole game.
export const CONFIG = {
  // World: a dusk alpine valley, measured in metres. The plane starts on the
  // home strip at x = 0 and flies east toward the far strip.
  WORLD_LENGTH: 11200,
  HOME_STRIP_X: 0,
  HOME_STRIP_LENGTH: 420,
  FAR_STRIP_X: 9800,
  FAR_STRIP_LENGTH: 560,
  RIVER_X: 3050,
  RIVER_WIDTH: 260,
  TOWN_X: 4300,
  TOWN_WIDTH: 700,
  PASS_START_X: 5600,
  PASS_END_X: 8200,

  // Flight model (arcade, but with real trade-offs: climb bleeds speed,
  // speed below the stall line sinks, gusts push the nose around).
  MAX_SPEED: 96,
  STALL_SPEED: 26,
  THRUST: 21,
  DRAG: 0.085,
  CLIMB_BLEED: 9.8,
  SINK_RATE: 2.0,
  PITCH_RATE: 1.35,
  MAX_PITCH_UP: 0.55,
  MAX_PITCH_DOWN: -0.5,
  FUEL_CAPACITY: 100,
  FUEL_BURN: 0.85,
  CRASH_DAMAGE: 100,

  // Landings: touch down gently and slow, or the strip takes it out of you.
  SAFE_TOUCHDOWN_VSPEED: 4.5,
  SAFE_TOUCHDOWN_SPEED: 48,
  HARD_TOUCHDOWN_VSPEED: 9,

  // Scoring.
  RING_POINTS: 150,
  DROP_POINTS: 400,
  LANDING_POINTS: 300,
  TIME_BONUS_PER_SECOND: 8,

  // Presentation.
  VIEW_WIDTH: 1280,
  VIEW_HEIGHT: 720,
  CAMERA_LOOKAHEAD: 170,
  GROUND_LINE: 0,
};

// Mission catalogue. Each mission reuses the same valley but changes the
// goal, the wind and the fuel, so the same sortie plays differently.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Thread all eight rings through the pass, then put her down on the far strip.',
    goal: 'rings',
    rings: 8,
    fuel: 100,
    windBase: 4,
    windGust: 6,
    parSeconds: 150,
  },
  {
    id: 'supply-drop',
    name: 'Supply Drop',
    tagline: 'Carry a crate to the stranded survey camp and drop it on the marked field.',
    goal: 'drop',
    rings: 4,
    fuel: 100,
    windBase: 6,
    windGust: 8,
    parSeconds: 170,
  },
  {
    id: 'storm-landing',
    name: 'Storm Landing',
    tagline: 'The front is already here. Land on the short strip in gusting crosswind.',
    goal: 'land',
    rings: 3,
    fuel: 80,
    windBase: 11,
    windGust: 16,
    parSeconds: 130,
  },
];
