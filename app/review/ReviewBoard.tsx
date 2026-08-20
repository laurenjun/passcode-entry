"use client";

import * as React from "react";
import Artboard from "@/components/Artboard/Artboard";
import PasscodeEntry from "@/components/PasscodeEntry/PasscodeEntry";
import styles from "./review.module.css";

/** Total width of the four 1512px frames plus the 40px gaps between them. */
const BOARD_WIDTH = 1512 * 4 + 40 * 3;

const ZOOMS = [
  { label: "Fit", value: 0 },
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "100%", value: 1 },
] as const;

export function ReviewBoard() {
  const [zoom, setZoom] = React.useState<number>(0);
  const [fit, setFit] = React.useState(0.25);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setFit(el.clientWidth / BOARD_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = zoom === 0 ? fit : zoom;

  return (
    <>
      <div className={styles.bar}>
        <span className={styles.legend}>
          Four 1512 × 982 frames, in Figma order. Zoom:
        </span>
        {ZOOMS.map((z) => (
          <button
            key={z.label}
            type="button"
            className={styles.zoom}
            aria-pressed={zoom === z.value}
            onClick={() => setZoom(z.value)}
          >
            {z.label}
          </button>
        ))}
      </div>

      <div className={styles.viewport} ref={viewportRef}>
        <div
          className={styles.board}
          style={{
            transform: `scale(${scale})`,
            height: 1010 * scale,
          }}
        >
          <Artboard name="empty state" outlined>
            <PasscodeEntry status="empty" />
          </Artboard>

          <Artboard name="filling in numbers" outlined>
            <PasscodeEntry status="filling" value="122" />
          </Artboard>

          <Artboard name="submit state" outlined>
            <PasscodeEntry status="submitting" value="1234" />
          </Artboard>

          <Artboard name="authenticated state" outlined>
            <PasscodeEntry status="authenticated" />
          </Artboard>
        </div>
      </div>
    </>
  );
}

export default ReviewBoard;
