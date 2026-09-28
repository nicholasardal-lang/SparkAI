"use client";

import { useEffect, useState } from "react";

type ShootingStar = {
  key: number;
  left: number;
  top: number;
  angle: number;
};

export default function ShootingStars() {
  const [star, setStar] = useState<ShootingStar | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStar({
        key: Date.now(),
        left: 5 + Math.random() * 78,
        top: 8 + Math.random() * 76,
        angle: 25 + Math.random() * 20,
      });
    }, 12_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="shooting-star-layer" aria-hidden="true">
      {star && (
        <span
          key={star.key}
          className="shooting-star"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            transform: `rotate(${star.angle}deg)`,
          }}
        />
      )}
    </div>
  );
}
