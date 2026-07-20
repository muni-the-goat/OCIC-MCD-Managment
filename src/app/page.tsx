import { redirect } from "next/navigation";

// proxy.ts routes "/" to /dashboard or /login; this is a fallback.
export default function Home() {
  redirect("/dashboard");
}
