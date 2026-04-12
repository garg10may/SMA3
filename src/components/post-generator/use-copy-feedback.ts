"use client";

import { useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_DURATION_MS = 1600;

export function useCopyFeedback() {
  const [copyState, setCopyState] = useState("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function resetCopyState() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setCopyState("");
  }

  function markCopied(key: string) {
    resetCopyState();
    setCopyState(key);
    timeoutRef.current = window.setTimeout(() => {
      setCopyState((current) => (current === key ? "" : current));
      timeoutRef.current = null;
    }, COPY_FEEDBACK_DURATION_MS);
  }

  return {
    copyState,
    markCopied,
    resetCopyState,
  };
}
