import { LoginForm } from "@/components/login-form";
import { OcicLogo } from "@/components/ocic-logo";
import { safeNextPath } from "@/lib/login-rules";
import styles from "./sign-in.module.css";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  // No `error` here on purpose. The Server Action used to redirect on failure,
  // and a redirect loses everything it knows, so the message travelled back in
  // the query string. The action returns its result now, so nothing writes this
  // parameter — and a parameter only an outsider can set is a sentence only an
  // outsider can put on the sign-in page, under our domain and our logo.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
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
          <LoginForm next={next} />
        </section>
        <p className={styles.accountNote}>
          Your office account is provided by an administrator.
        </p>
      </div>
    </main>
  );
}
