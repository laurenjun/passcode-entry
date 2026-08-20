import ReviewBoard from "./ReviewBoard";
import styles from "./review.module.css";

/**
 * Review surface: the four states laid out in Figma order so they can be
 * compared against the design side by side. Each frame is a true
 * 1512 x 982 artboard; the zoom control only scales the whole board.
 * For a 1:1 comparison against a Figma export, use /artboard/<state>.
 */
export default function ReviewPage() {
  return (
    <main className={styles.page}>
      <ReviewBoard />
    </main>
  );
}
