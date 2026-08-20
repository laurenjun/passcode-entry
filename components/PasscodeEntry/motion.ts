import type { Transition } from "framer-motion";

/**
 * Every timing, spring, and magnitude the passcode component animates with.
 * This is the only place numbers live — components read the resolved spec from
 * `useMotionSpec()` and never hold a value of their own.
 */
export const PASSCODE_MOTION = {
  /**
   * 1. A digit lands in a cell.
   * Critically damped (ζ ≈ 1.00), so it cannot overshoot, and stiff enough to
   * be visually settled in ~135ms. Below ~1600 stiffness it runs past 150ms.
   */
  DIGIT_ENTRY: { type: "spring", stiffness: 1800, damping: 85 },

  /**
   * 2. The focus indicator travels between cells.
   * ζ ≈ 0.90: technically it overshoots, but by 0.13px over an 84px trip,
   * which is under a pixel and reads as exact. ~194ms across one cell.
   */
  FOCUS_MOVE: { type: "spring", stiffness: 900, damping: 54 },

  /**
   * 3a. The container's oscillation on a rejected code.
   * ζ ≈ 0.35 is what produces diminishing rather than even swings — 10px,
   * 3.0px, 0.9px, then under the visibility floor. Three swings, done in
   * ~340ms. Damping sets the *shape* of the decay; stiffness sets the speed,
   * so raise stiffness alone to make it snappier without flattening it.
   */
  ERROR_SHAKE: { stiffness: 1800, damping: 30, amplitude: 10 },

  /**
   * 3b. How long the wrong digits are held before the cells clear.
   * The shake finishes around 340ms, so this leaves ~260ms of stillness to
   * actually read what you typed. Much under 500 and it clears mid-shake.
   */
  ERROR_HOLD_MS: 600,

  /** 4a. The wave that runs across the cells while verifying. */
  LOADING_PULSE: { duration: 1, stagger: 0.08 },

  /**
   * 4b. The loading mark's own rotation while verifying.
   * The mark has eight identical spokes, so it is symmetric every 45° — one
   * perceived tick is duration / 8, here ~112ms.
   */
  LOADING_SPIN: { duration: 0.9, degrees: 360 },

  /**
   * 5. The cells resolving on success.
   * ζ ≈ 0.72 keeps a small pop on the way in — this is the one moment where a
   * little overshoot is the point — and settles in ~240ms.
   */
  SUCCESS: { type: "spring", stiffness: 500, damping: 32, stagger: 0.05 },

  /**
   * 5b. The check mark drawing itself in.
   * A tween, not a spring: a stroke being drawn should decelerate to its end
   * and stop, never overshoot past it. The delay lets the success row land
   * first (SUCCESS settles in ~240ms) so the tick draws into a settled box.
   */
  SUCCESS_DRAW: { duration: 0.32, delay: 0.08 },

  /**
   * The other half of each knob. A spring says how a value moves; these say
   * how far. Not in the brief, but they have to live here too or the numbers
   * leak back into the components.
   */
  AMPLITUDE: {
    /** Peak scale of a cell as a digit lands. 1.08 = ~6.7px on an 84px cell. */
    DIGIT_ENTRY_SCALE: 1.08,
    /** Trough opacity of the loading wave. Deeper than ~0.45 starts to blink. */
    LOADING_PULSE_OPACITY: 0.5,
    /** Scale a cell resolves to as it leaves on success. */
    SUCCESS_SCALE: 0.96,
    /** Vertical travel, in px, of a cell leaving on success. */
    SUCCESS_LIFT: -6,
  },
} as const;

const INSTANT: Transition = { duration: 0 };

/** Ready-to-use spec. Components consume this shape, never the raw constants. */
export interface PasscodeMotion {
  reduced: boolean;

  /** 1. Digit entry. */
  digitEntry: Transition;
  digitEntryScale: number;

  /** 2. Focus move. */
  focusMove: Transition;

  /** 3. Error. */
  shake: Transition;
  shakeAmplitude: number;
  errorHoldMs: number;

  /** 4. Loading. */
  loading: (index: number) => Transition;
  loadingOpacity: number;
  spin: Transition;
  spinDegrees: number;

  /** 5. Success. */
  success: Transition;
  successDraw: Transition;
  successStagger: number;
  successScale: number;
  successLift: number;
}

/**
 * Collapses the constants into the spec the components use. This is the single
 * place `prefers-reduced-motion` is applied: when set, every transition becomes
 * instant and every magnitude collapses to its resting value, so state changes
 * land with no motion at all and no component has to know why.
 */
export function resolveMotion(reduced: boolean): PasscodeMotion {
  const {
    DIGIT_ENTRY,
    FOCUS_MOVE,
    ERROR_SHAKE,
    ERROR_HOLD_MS,
    LOADING_PULSE,
    LOADING_SPIN,
    SUCCESS,
    SUCCESS_DRAW,
    AMPLITUDE,
  } = PASSCODE_MOTION;

  const { amplitude: shakeAmplitude, ...shakeSpring } = ERROR_SHAKE;
  const { stagger: successStagger, ...successSpring } = SUCCESS;
  const { stagger: loadingStagger, ...loadingTiming } = LOADING_PULSE;
  const { degrees: spinDegrees, ...spinTiming } = LOADING_SPIN;

  if (reduced) {
    return {
      reduced,
      digitEntry: INSTANT,
      digitEntryScale: 1,
      focusMove: INSTANT,
      shake: INSTANT,
      shakeAmplitude: 0,
      errorHoldMs: ERROR_HOLD_MS,
      loading: () => INSTANT,
      loadingOpacity: 1,
      spin: INSTANT,
      spinDegrees: 0,
      success: INSTANT,
      successDraw: INSTANT,
      successStagger: 0,
      successScale: 1,
      successLift: 0,
    };
  }

  return {
    reduced,
    digitEntry: DIGIT_ENTRY as Transition,
    digitEntryScale: AMPLITUDE.DIGIT_ENTRY_SCALE,
    focusMove: FOCUS_MOVE as Transition,
    shake: { type: "spring", ...shakeSpring } as Transition,
    shakeAmplitude,
    errorHoldMs: ERROR_HOLD_MS,
    loading: (index: number) => ({
      ...loadingTiming,
      delay: index * loadingStagger,
      repeat: Infinity,
      ease: "easeInOut",
    }),
    loadingOpacity: AMPLITUDE.LOADING_PULSE_OPACITY,
    spin: {
      ...spinTiming,
      ease: "linear",
      repeat: Infinity,
      repeatType: "loop",
    } as Transition,
    spinDegrees,
    success: successSpring as Transition,
    successDraw: { ...SUCCESS_DRAW, ease: "easeOut" } as Transition,
    successStagger,
    successScale: AMPLITUDE.SUCCESS_SCALE,
    successLift: AMPLITUDE.SUCCESS_LIFT,
  };
}
