"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginResult } from "@/app/login/actions";
import { LoginFeedback } from "@/components/login-feedback";
import { LoginSubmit } from "@/components/login-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/login-rules";
import styles from "@/app/login/sign-in.module.css";

export function LoginForm({ next }: { next: string | null }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Controlled inputs survive an unsuccessful action without serializing a
  // password back from the server or putting credentials into a URL.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [result, formAction, pending] = useActionState<LoginResult | null, FormData>(
    async (_previous, formData) => {
      try {
        const response = await login(formData);
        if (response.status === "success") {
          setPassword("");
          setVisible(false);
        }
        return response;
      } catch {
        // Includes a failed network request before the Server Action can reply.
        return {
          id: crypto.randomUUID(),
          status: "error",
          message: "We couldn’t connect to sign you in. Please try again.",
        };
      }
    },
    null
  );

  const signedIn = result?.status === "success";
  const error = !pending && result?.status === "error" ? result : null;
  const emailInvalid = error?.field === "email" || error?.field === "credentials";
  const passwordInvalid = error?.field === "password" || error?.field === "credentials";

  // The error used to arrive in a dialog, which took focus and then handed it
  // back on close. It reads inline now, so the focus move happens here instead —
  // otherwise a keyboard or screen-reader user is told something is wrong and
  // left standing where they were.
  useEffect(() => {
    if (!error) return;
    if (error.field === "email") emailRef.current?.focus();
    else passwordRef.current?.focus();
  }, [error]);

  return (
    <>
      <form action={formAction} className={styles.form} aria-busy={pending}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className={styles.field}>
          <Label htmlFor="email">Office email</Label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={pending || signedIn}
            aria-invalid={emailInvalid || undefined}
            aria-describedby={error ? "sign-in-error" : undefined}
            placeholder={`you${ALLOWED_EMAIL_DOMAIN}`}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="password">Password</Label>
          <div className={styles.passwordField}>
            <Input
              ref={passwordRef}
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              readOnly={pending || signedIn}
              aria-invalid={passwordInvalid || undefined}
              aria-describedby={error ? "sign-in-error" : undefined}
              placeholder="Enter your password"
              className={styles.input}
            />
            <Button
              type="button"
              variant="ghost"
              className={styles.revealButton}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-controls="password"
              disabled={pending || signedIn}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </Button>
          </div>
        </div>

        {error ? <p id="sign-in-error" className={styles.inlineError}>{error.message}</p> : null}

        <div className={styles.submitArea}>
          <LoginSubmit signedIn={signedIn} />
          <span className="sr-only" role="status">
            {pending ? "Checking your sign-in details." : ""}
          </span>
        </div>
        <button
          type="button"
          className={styles.helpButton}
          aria-expanded={helpOpen}
          aria-controls="sign-in-help"
          onClick={() => setHelpOpen((value) => !value)}
        >
          Need help signing in?
        </button>
        {helpOpen ? (
          <p id="sign-in-help" className={styles.helpText}>
            Use your {ALLOWED_EMAIL_DOMAIN} account. If you’ve forgotten your
            password, ask a coordinator or administrator to reset it.
          </p>
        ) : null}
      </form>
      {/* Success only. An error is already on the page, under the field that
          caused it; saying it a second time in a modal that has to be dismissed
          makes a mistyped password into a task. */}
      {result?.status === "success" && !pending ? (
        <LoginFeedback key={result.id} next={result.next} />
      ) : null}
    </>
  );
}
