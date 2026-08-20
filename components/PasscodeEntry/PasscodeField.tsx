"use client";

import * as React from "react";
import PasscodeEntry, { type PasscodeStatus } from "./PasscodeEntry";
import { useMotionSpec } from "./MotionProvider";
import styles from "./PasscodeField.module.css";

type Phase = "entry" | "submitting" | "error" | "authenticated";

interface State {
  digits: string[];
  /** Cell carrying the highlight. */
  activeIndex: number;
  phase: Phase;
  /** Bumped on each rejection so the shake replays. */
  shakeToken: number;
}

type Action =
  /** One or more digits arriving at once: a keypress, a paste, a soft key. */
  | { type: "insert"; digits: string }
  | { type: "erase" }
  /** Clicking a cell focuses that cell, whatever is already typed. */
  | { type: "focusCell"; index: number }
  | { type: "submit" }
  | { type: "settle"; ok: boolean }
  | { type: "recover" };

interface ReducerConfig {
  /** Submit the moment the last cell fills, without waiting for Enter. */
  autoSubmit: boolean;
}

function makeReducer({ autoSubmit }: ReducerConfig) {
  /**
   * Every write goes through here, so completeness is evaluated in the same
   * atomic update that lands the digit. That is what makes auto-submit safe:
   * a burst of inserts cannot each see an incomplete code and all fire.
   */
  function land(state: State, digits: string[], nextIndex: number): State {
    const complete = digits.every((d) => d !== "");
    return {
      ...state,
      digits,
      activeIndex: Math.min(digits.length - 1, nextIndex),
      phase: autoSubmit && complete ? "submitting" : state.phase,
    };
  }

  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      /* Rule 2: each digit advances focus to the next cell. A paste is just
         several of those in a row, so it shares the path. */
      case "insert": {
        if (state.phase !== "entry") return state;
        const digits = [...state.digits];
        let cursor = state.activeIndex;
        for (const digit of action.digits) {
          if (cursor >= digits.length) break;
          digits[cursor] = digit;
          cursor += 1;
        }
        if (cursor === state.activeIndex) return state;
        return land(state, digits, cursor);
      }

      case "focusCell": {
        if (state.phase !== "entry") return state;
        const index = Math.min(
          Math.max(action.index, 0),
          state.digits.length - 1,
        );
        if (index === state.activeIndex) return state;
        return { ...state, activeIndex: index };
      }

      /*
       * Rule 3: Delete/Backspace clears the current cell.
       * Rule 4: if it is already empty, focus moves to the previous cell.
       * Rule 5 falls out of 3 + 4 under the browser's key auto-repeat: clear,
       * step back, clear, step back…
       */
      case "erase": {
        if (state.phase !== "entry") return state;
        if (state.digits[state.activeIndex]) {
          const digits = [...state.digits];
          digits[state.activeIndex] = "";
          return { ...state, digits };
        }
        return { ...state, activeIndex: Math.max(0, state.activeIndex - 1) };
      }

      /* Rule 1: Enter submits. The phase guard is also the double-submit
         guard — Enter during the verify delay is a no-op. */
      case "submit": {
        if (state.phase !== "entry") return state;
        /* Too early: shake, but stay in `entry`. An incomplete code is not a
           wrong one, so the digits and the focused cell are left alone and the
           user can just keep typing. */
        if (state.digits.some((d) => d === "")) {
          return { ...state, shakeToken: state.shakeToken + 1 };
        }
        return { ...state, phase: "submitting" };
      }

      /* A rejected code shakes and holds the wrong digits; `recover` clears. */
      case "settle": {
        if (state.phase !== "submitting") return state;
        if (action.ok) return { ...state, phase: "authenticated" };
        return { ...state, phase: "error", shakeToken: state.shakeToken + 1 };
      }

      case "recover": {
        if (state.phase !== "error") return state;
        return {
          ...state,
          digits: Array(state.digits.length).fill(""),
          activeIndex: 0,
          phase: "entry",
        };
      }
    }
  };
}

export interface PasscodeFieldProps {
  /** The code that unlocks. */
  passcode?: string;
  length?: number;
  /** How long the submit state is held before it settles. */
  verifyDelayMs?: number;
  /** Submit as soon as the last cell fills. Enter still works either way. */
  autoSubmit?: boolean;
  autoFocus?: boolean;
}

export function PasscodeField({
  passcode = "1234",
  length = 4,
  verifyDelayMs = 2000,
  autoSubmit = true,
  autoFocus = true,
}: PasscodeFieldProps) {
  const m = useMotionSpec();
  const reducer = React.useMemo(() => makeReducer({ autoSubmit }), [autoSubmit]);
  const [state, dispatch] = React.useReducer(reducer, {
    digits: Array(length).fill(""),
    activeIndex: 0,
    phase: "entry",
    shakeToken: 0,
  });
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const entered = state.digits.join("");

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* Hold the submit state for a couple of seconds before it resolves. */
  React.useEffect(() => {
    if (state.phase !== "submitting") return;
    const id = window.setTimeout(
      () => dispatch({ type: "settle", ok: entered === passcode }),
      verifyDelayMs,
    );
    return () => window.clearTimeout(id);
  }, [state.phase, entered, passcode, verifyDelayMs]);

  /* Then let the wrong digits sit for a beat before clearing them. */
  React.useEffect(() => {
    if (state.phase !== "error") return;
    const id = window.setTimeout(
      () => dispatch({ type: "recover" }),
      m.errorHoldMs,
    );
    return () => window.clearTimeout(id);
  }, [state.phase, m.errorHoldMs]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
      dispatch({ type: "submit" });
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      dispatch({ type: "erase" });
      return;
    }

    /* Rule 1: digits only. Everything else is swallowed. */
    if (event.key.length === 1) {
      event.preventDefault();
      if (/^[0-9]$/.test(event.key)) {
        dispatch({ type: "insert", digits: event.key });
      }
    }
  }

  /*
   * Focus follows the click. The input is one transparent box over the whole
   * field, so the cell is worked out from where in it the pointer landed —
   * which keeps a single element owning focus while still letting any cell be
   * picked directly.
   */
  function handlePointerDown(event: React.PointerEvent<HTMLInputElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * length);
    dispatch({ type: "focusCell", index });
  }

  /** Paste fills from the focused cell onward; anything non-numeric is dropped. */
  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits) dispatch({ type: "insert", digits });
  }

  /*
   * Desktop keys and pastes are handled above and prevented, so this only
   * fires for input that produces neither — soft keyboards, IME, autofill.
   */
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    if (digits) dispatch({ type: "insert", digits });
    event.target.value = "";
  }

  const status: PasscodeStatus =
    state.phase === "authenticated"
      ? "authenticated"
      : state.phase === "submitting"
        ? "submitting"
        : entered
          ? "filling"
          : "empty";

  /* The highlight is a focus affordance: it shows while the field has focus
     and is either accepting input or holding a rejected code. */
  const accepting = state.phase === "entry" || state.phase === "error";
  const activeIndex = accepting && focused ? state.activeIndex : null;

  return (
    <div className={styles.wrapper}>
      {state.phase !== "authenticated" ? (
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Passcode"
          /* readOnly rather than disabled: `disabled` blurs the input, so a
             rejected code would drop focus and the highlight would not come
             back without a click. Key handling is gated on the phase anyway. */
          readOnly={state.phase !== "entry"}
          aria-busy={state.phase === "submitting"}
          value=""
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onPointerDown={handlePointerDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : null}

      <PasscodeEntry
        status={status}
        value={state.digits}
        length={length}
        activeIndex={activeIndex}
        shakeToken={state.shakeToken}
      />
    </div>
  );
}

export default PasscodeField;
