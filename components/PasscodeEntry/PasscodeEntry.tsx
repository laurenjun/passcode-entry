"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  type Variants,
} from "framer-motion";
import styles from "./PasscodeEntry.module.css";
import { useMotionSpec } from "./MotionProvider";
import type { PasscodeMotion } from "./motion";
import {
  CHECK_TICK_PATH,
  CHECK_TICK_WIDTH,
  CheckSquareIcon,
  SpinnerIcon,
} from "./icons";

export type PasscodeStatus =
  /** No digits entered yet. */
  | "empty"
  /** Digits are being entered; `activeIndex` carries the highlight. */
  | "filling"
  /** Code submitted, waiting on the server. */
  | "submitting"
  /** Code accepted — the component is replaced by the success row. */
  | "authenticated";

export interface PasscodeEntryProps {
  /** Which visual state to render. Drives every other default. */
  status?: PasscodeStatus;
  /** Digits to display, e.g. "122". Characters past `length` are ignored. */
  value?: string;
  /** Number of cells. */
  length?: number;
  /**
   * Cell that carries the highlight. Defaults to the last entered digit while
   * `status` is "filling". Pass `null` to hide the highlight entirely.
   */
  activeIndex?: number | null;
  /** Overrides the copy in the status row. */
  label?: string;
  /**
   * Bump this to fire the error shake. A token rather than a boolean so that
   * two rejections in a row both play.
   */
  shakeToken?: number;
  className?: string;
}

const DEFAULT_LABELS: Partial<Record<PasscodeStatus, string>> = {
  submitting: "Verifying...",
  authenticated: "Authenticated",
};

/* ------------------------------------------------------------------ *
 * Cell
 * ------------------------------------------------------------------ */

function Cell({
  index,
  digit,
  active,
  disabled,
  loading,
  m,
}: {
  index: number;
  digit: string;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  m: PasscodeMotion;
}) {
  const controls = useAnimationControls();
  const previousDigit = React.useRef(digit);

  /* 1. Digit entry — the cell scales as a digit lands. Seeded from the first
     render, so a statically rendered cell never pops on mount. */
  React.useEffect(() => {
    const had = previousDigit.current;
    previousDigit.current = digit;
    if (!digit || digit === had) return;
    controls.set({ scale: m.digitEntryScale });
    controls.start({ scale: 1, transition: m.digitEntry });
  }, [digit, controls, m]);

  /*
   * 4. Loading — each cell joins the wave, offset by its index.
   *
   * The wave is torn down in the effect body on the way out rather than in a
   * cleanup: the cells unmount while `loading` is still true (the success exit
   * runs at the same moment), and touching controls after unmount throws.
   */
  const wasLoading = React.useRef(false);
  React.useEffect(() => {
    if (loading) {
      wasLoading.current = true;
      controls.start({
        opacity: [1, m.loadingOpacity, 1],
        transition: m.loading(index),
      });
      return;
    }
    if (!wasLoading.current) return;
    wasLoading.current = false;
    controls.stop();
    controls.set({ opacity: 1 });
  }, [loading, index, controls, m]);

  return (
    <motion.div
      className={styles.cell}
      data-tone={disabled ? "disabled" : undefined}
      data-active={active ? "true" : undefined}
      variants={cellVariants}
    >
      <motion.div className={styles.cellInner} animate={controls}>
        {digit ? <span className={styles.digit}>{digit}</span> : null}
        {active ? (
          /* 2. Focus move — one shared element, so Framer tweens it between
             cells instead of cross-fading two of them. */
          <motion.span
            layoutId="passcode-highlight"
            className={styles.highlight}
            transition={m.focusMove}
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/*
 * 4b. The loading mark turns for as long as it is mounted, which is only ever
 * while verifying. Driven through controls rather than an `animate` prop: the
 * enclosing AnimatePresence is `initial={false}`, and that suppresses a child's
 * first animation whether it is written as a target or as keyframes.
 */
function SpinnerMark({ m }: { m: PasscodeMotion }) {
  const controls = useAnimationControls();

  React.useEffect(() => {
    controls.start({ rotate: [0, m.spinDegrees], transition: m.spin });
  }, [controls, m]);

  return (
    <motion.span className={styles.statusIcon} animate={controls}>
      <SpinnerIcon />
    </motion.span>
  );
}

/*
 * 5b. The tick draws itself along its own centreline. `pathLength` needs a
 * stroked path, which is why the tick is split out of the exported fill.
 * Controls again, for the same reason as the spinner.
 */
function CheckMark({ m }: { m: PasscodeMotion }) {
  const controls = useAnimationControls();

  React.useEffect(() => {
    controls.start({ pathLength: 1, transition: m.successDraw });
  }, [controls, m]);

  return (
    <CheckSquareIcon
      tick={
        <motion.path
          d={CHECK_TICK_PATH}
          stroke="currentColor"
          strokeWidth={CHECK_TICK_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={controls}
        />
      }
    />
  );
}

/* 5. Success — the cells resolve together, staggered as they leave. */
const cellVariants: Variants = {
  rest: { opacity: 1, y: 0, scale: 1 },
  resolve: (m: PasscodeMotion) => ({
    opacity: 0,
    y: m.successLift,
    scale: m.successScale,
    transition: m.success,
  }),
};

const fieldVariants: Variants = {
  rest: {},
  resolve: (m: PasscodeMotion) => ({
    transition: { staggerChildren: m.successStagger },
  }),
};

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function PasscodeEntry({
  status = "empty",
  value = "",
  length = 4,
  activeIndex,
  label,
  shakeToken = 0,
  className,
}: PasscodeEntryProps) {
  const m = useMotionSpec();
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const disabled = status === "submitting";

  const resolvedActive =
    activeIndex !== undefined
      ? activeIndex
      : status === "filling"
        ? Math.min(Math.max(value.length - 1, 0), length - 1)
        : null;

  const statusText = label ?? DEFAULT_LABELS[status];

  /* 3. Error — a single spring release from the amplitude back to rest, which
     gives diminishing swings rather than an even keyframed wobble. */
  const shakeControls = useAnimationControls();
  const seenShake = React.useRef(shakeToken);
  React.useEffect(() => {
    if (shakeToken === seenShake.current) return;
    seenShake.current = shakeToken;
    shakeControls.set({ x: m.shakeAmplitude });
    shakeControls.start({ x: 0, transition: m.shake });
  }, [shakeToken, shakeControls, m]);

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="wait" initial={false}>
        {status === "authenticated" ? (
          <motion.div
            key="success"
            className={styles.status}
            initial={{ opacity: 0, scale: m.successScale }}
            animate={{ opacity: 1, scale: 1 }}
            transition={m.success}
          >
            <span className={styles.statusIcon}>
              <CheckMark m={m} />
            </span>
            <span className={styles.statusLabel}>{statusText}</span>
          </motion.div>
        ) : (
          <motion.div
            key="field"
            className={styles.field}
            variants={fieldVariants}
            custom={m}
            initial={false}
            animate="rest"
            exit="resolve"
          >
            {statusText ? (
              <div className={`${styles.status} ${styles.statusFloating}`}>
                <SpinnerMark m={m} />
                <span className={styles.statusLabel}>{statusText}</span>
              </div>
            ) : null}

            <motion.div
              className={styles.cells}
              data-tone={disabled ? "disabled" : undefined}
              animate={shakeControls}
            >
              {digits.map((digit, i) => (
                <Cell
                  key={i}
                  index={i}
                  digit={digit}
                  active={resolvedActive === i}
                  disabled={disabled}
                  loading={disabled}
                  m={m}
                />
              ))}

              {Array.from({ length: length - 1 }, (_, i) => (
                <span
                  key={`divider-${i}`}
                  className={styles.divider}
                  style={{
                    left: `calc(var(--passcode-cell-width) * ${i + 1})`,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PasscodeEntry;
