import * as React from "react";
import styles from "./Artboard.module.css";

export function Artboard({
  name,
  outlined = false,
  children,
}: {
  name?: string;
  outlined?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      {name ? <div className={styles.name}>{name}</div> : null}
      <div
        className={[styles.frame, outlined ? styles.outlined : null]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export default Artboard;
