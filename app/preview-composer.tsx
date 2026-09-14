"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { saveIdea } from "@/lib/spark/draft";

export default function PreviewComposer() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    if (!saveIdea(value)) { setError("Enable browser storage to carry your idea into signup."); return; }
    window.location.assign("/signup");
  };
  return (
    <form className="preview-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="preview-prompt">
        Try Spark
      </label>
      <input
        id="preview-prompt"
        required
        maxLength={8000}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="What would you like to build?"
        aria-label="Try Spark"
      />
      <button type="submit" aria-label="Send prompt">
        <ArrowUp size={26} />
      </button>
      {error && <span role="alert">{error}</span>}
    </form>
  );
}
