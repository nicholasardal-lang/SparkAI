"use client";
import { LogoMark } from "@/components/brand";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="auth-card">
      <a className="brand" href="/">
        <LogoMark /> <span>Spark</span>
      </a>
      <h1>Something didn’t load.</h1>
      <p>Spark couldn’t reach your workspace. Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
