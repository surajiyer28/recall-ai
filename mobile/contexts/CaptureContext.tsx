import React, { createContext, useContext } from "react";
import { useCaptureStatus } from "../hooks/useCaptureStatus";

type CaptureCtx = ReturnType<typeof useCaptureStatus>;

const Ctx = createContext<CaptureCtx | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const value = useCaptureStatus();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCapture(): CaptureCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCapture must be inside CaptureProvider");
  return ctx;
}
