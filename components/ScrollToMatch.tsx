"use client";

import { useEffect } from "react";

type ScrollToMatchProps = {
  matchId: number | null;
};

export function ScrollToMatch({ matchId }: ScrollToMatchProps) {
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

  return null;
}
