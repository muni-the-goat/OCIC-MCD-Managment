"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/app/login/sign-in.module.css";

export function LoginSubmit({ signedIn = false }: { signedIn?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className={styles.signInButton}
      disabled={pending || signedIn}
      aria-busy={pending}
    >
      {pending ? <LoaderCircle className={styles.spinner} aria-hidden /> : null}
      <span>{pending ? "Signing in…" : signedIn ? "Signed in" : "Sign in"}</span>
      {!pending && !signedIn ? <ArrowRight className="size-5" aria-hidden /> : null}
    </Button>
  );
}
