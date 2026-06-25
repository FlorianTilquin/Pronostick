"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

type ScrollToMatchProps = {
  matchId: number | null;
};

export function ScrollToMatch({ matchId }: ScrollToMatchProps) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (matchId === null) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`match-${matchId}`)?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [matchId]);

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 360);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <button
      className={`back-to-top ${showBackToTop ? "visible" : ""}`}
      type="button"
      aria-label="Revenir en haut du tableau"
      title="Revenir en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
