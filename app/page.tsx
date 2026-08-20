import PasscodeField from "@/components/PasscodeEntry/PasscodeField";
import styles from "./page.module.css";

/**
 * The four frames combined into one live component: type digits, press Enter
 * to submit, and the field moves through verifying into authenticated.
 */
export default function Page() {
  return (
    <main className={styles.page}>
      <PasscodeField />
    </main>
  );
}
