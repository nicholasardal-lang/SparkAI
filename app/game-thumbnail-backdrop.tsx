"use client";

import { useEffect, useRef, useState } from "react";

const thumbnailCount = 16;
const previewSlots = 4;
const thumbnailPath = (index: number) =>
  `/game-thumbnails/game-${String(index + 1).padStart(2, "0")}.png`;

export default function GameThumbnailBackdrop() {
  const [visibleIndexes, setVisibleIndexes] = useState([0, 1, 2, 3]);
  const visibleRef = useRef(visibleIndexes);
  const nextSlotRef = useRef(0);
  const nextThumbnailRef = useRef(previewSlots);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const slot = nextSlotRef.current;
      let nextThumbnail = nextThumbnailRef.current;

      for (let attempts = 0; attempts < thumbnailCount; attempts += 1) {
        if (!visibleRef.current.includes(nextThumbnail)) break;
        nextThumbnail = (nextThumbnail + 1) % thumbnailCount;
      }

      const nextVisible = visibleRef.current.map((index, currentSlot) =>
        currentSlot === slot ? nextThumbnail : index,
      );

      visibleRef.current = nextVisible;
      setVisibleIndexes(nextVisible);
      nextSlotRef.current = (slot + 1) % previewSlots;
      nextThumbnailRef.current = (nextThumbnail + 1) % thumbnailCount;
    }, 5_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="game-thumbnail-backdrop" aria-hidden="true">
      {visibleIndexes.map((index, slot) => (
        <div className={`game-thumbnail-card game-thumbnail-card-${slot + 1}`} key={slot}>
          <img key={index} src={thumbnailPath(index)} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
}
