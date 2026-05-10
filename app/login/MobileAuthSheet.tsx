"use client";

import { useEffect, useRef } from "react";
import AuthCard, { type AuthMode } from "./AuthCard";

interface MobileAuthSheetProps {
  open: boolean;
  defaultMode: AuthMode;
  onClose: () => void;
  theme: "dark" | "light";
}

export default function MobileAuthSheet({ open, defaultMode, onClose, theme }: MobileAuthSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const t = theme;

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        .mas-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.35s ease;
        }
        .mas-backdrop.open {
          opacity: 1;
          pointer-events: all;
        }

        .mas-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 201;
          border-radius: 28px 28px 0 0;
          background: ${t === "dark" ? "rgba(10,14,24,0.97)" : "rgba(255,255,255,0.98)"};
          border-top: 1px solid ${t === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};
          box-shadow: 0 -24px 80px rgba(0,0,0,0.4);
          /* max-height so it never covers entire screen on tall phones */
          max-height: 92dvh;
          overflow-y: auto;
          overscroll-behavior: contain;
          /* scrollbar */
          scrollbar-width: none;
          transform: translateY(110%);
          transition: transform 0.45s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
          padding: 0 1.25rem 2rem;
          /* safe-area for notched phones */
          padding-bottom: calc(2rem + env(safe-area-inset-bottom));
        }
        .mas-sheet::-webkit-scrollbar { display: none; }
        .mas-sheet.open {
          transform: translateY(0);
        }

        /* Drag handle */
        .mas-handle-wrap {
          display: flex; justify-content: center;
          padding: 0.75rem 0 1rem;
          position: sticky; top: 0;
          background: ${t === "dark" ? "rgba(10,14,24,0.97)" : "rgba(255,255,255,0.98)"};
          z-index: 1;
        }
        .mas-handle {
          width: 40px; height: 4px; border-radius: 99px;
          background: ${t === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)"};
        }

        /* Close button */
        .mas-close {
          position: absolute; top: 0.65rem; right: 1rem;
          background: none; border: none; cursor: pointer;
          color: ${t === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"};
          font-size: 1.4rem; line-height: 1; padding: 0.25rem;
          transition: color 0.2s;
        }
        .mas-close:hover { color: ${t === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)"}; }

        /* Card inside sheet */
        .mas-card-inner {
          /* no card shell — sheet IS the container */
        }
      `}</style>

      {/* Backdrop */}
      <div className={`mas-backdrop${open ? " open" : ""}`} onClick={handleBackdropClick} aria-hidden="true" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`mas-sheet${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create account"
      >
        <div className="mas-handle-wrap">
          <div className="mas-handle" />
          <button className="mas-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mas-card-inner">
          <AuthCard
            defaultMode={defaultMode}
            onSuccess={() => {
              onClose();
              // navigation handled inside AuthCard → router.push
            }}
          />
        </div>
      </div>
    </>
  );
}