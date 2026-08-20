"use client";

import * as React from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { resolveMotion, type PasscodeMotion } from "./motion";

const MotionSpecContext = React.createContext<PasscodeMotion | null>(null);

export function useMotionSpec(): PasscodeMotion {
  const spec = React.useContext(MotionSpecContext);
  if (!spec) {
    throw new Error("useMotionSpec must be used inside <PasscodeMotionProvider>");
  }
  return spec;
}

/**
 * The one place `prefers-reduced-motion` is read. Everything below consumes the
 * already-resolved spec, so no component branches on the media query itself.
 */
export function PasscodeMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const spec = React.useMemo(() => resolveMotion(reduced), [reduced]);

  return (
    <MotionSpecContext.Provider value={spec}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </MotionSpecContext.Provider>
  );
}

export default PasscodeMotionProvider;
