"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  const resetCopyState = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setCopyState("");
  }, []);

  const markCopied = useCallback((key: string) => {
    resetCopyState();
    setCopyState(key);
    timeoutRef.current = window.setTimeout(() => {
      setCopyState((current) => (current === key ? "" : current));
      timeoutRef.current = null;
    }, COPY_FEEDBACK_DURATION_MS);
  }, [resetCopyState]);

  return {
    copyState,
    markCopied,
    resetCopyState,
  };
}
