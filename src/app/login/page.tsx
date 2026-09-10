import { LoginForm } from "@/components/login-form";
import { OcicLogo } from "@/components/ocic-logo";
import { safeNextPath } from "@/lib/login-rules";
import styles from "./sign-in.module.css";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  // Validate here too, so an attacker-supplied destination never reaches the DOM.
  const next = safeNextPath(rawNext);

  return (
    <main className={styles.page}>
      <div className={styles.workspace}>
        <OcicLogo width={148} height={63} priority className={styles.logo} />
        <section className={styles.card} aria-labelledby="sign-in-title">
          <header className={styles.header}>
            <h1 id="sign-in-title">Welcome back</h1>
            <p>Sign in to MCD Management.</p>
          </header>
          <LoginForm next={next} initialError={error} />
        </section>
        <p className={styles.accountNote}>
          Your office account is provided by an administrator.
        </p>
      </div>
    </main>
  );
}
