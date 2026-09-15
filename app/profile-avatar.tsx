"use client";
import { useEffect, useState } from "react";

export default function ProfileAvatar({ username, color = "violet", large = false }: { username?: string; color?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => { setFailed(false); setVersion(Date.now()); };
    window.addEventListener("spark-profile-updated", refresh);
    return () => window.removeEventListener("spark-profile-updated", refresh);
  }, []);
  return <span className={`profile-avatar ${large ? "avatar-large" : ""} ${color}`}>
    {!failed ? <img src={`/api/profile/avatar?v=${version}`} alt="Profile picture" onError={() => setFailed(true)} /> : username?.slice(0,2).toUpperCase() || "✦"}
  </span>;
}
