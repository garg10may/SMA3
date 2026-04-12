"use client";

import type { ReactNode } from "react";
import type {
  ShortStatus,
  WorkspaceId,
} from "@/components/post-generator/types";

type CopyActionButtonProps = {
  copied: boolean;
  label: string;
  onClick: () => void;
};

export function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="8" height="10" rx="1.8" />
      <path d="M3.5 10.5H3A1.5 1.5 0 0 1 1.5 9V3A1.5 1.5 0 0 1 3 1.5h6A1.5 1.5 0 0 1 10.5 3v0.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 5.5V2.5h-3" />
      <path d="M3 10.5v3h3" />
      <path d="M12.2 7A4.5 4.5 0 0 0 4.6 4.3L3 5.5" />
      <path d="M3.8 9A4.5 4.5 0 0 0 11.4 11.7L13 10.5" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10 3.5-4 4.5 4 4.5" />
    </svg>
  );
}

export function WorkspaceIcon({ workspace }: { workspace: WorkspaceId }) {
  if (workspace === "x") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3.5 13 12.5" />
        <path d="M13 3.5 3 12.5" />
      </svg>
    );
  }

  if (workspace === "medium") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 12.5V3.5h2.5l3 4.2 3-4.2h2.5v9" />
        <path d="M8 7.7v4.8" />
      </svg>
    );
  }

  if (workspace === "shorts") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="2.5" width="10" height="11" rx="2" />
        <path d="m7 5.5 3 2.5-3 2.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="2.25" />
      <path d="M8.5 8.5 13 13" />
      <path d="M11 4.25h2.5" />
      <path d="M12.25 3v2.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7v3" />
      <path d="M8 5.25h.01" />
    </svg>
  );
}

export function CopyActionButton({
  copied,
  label,
  onClick,
}: CopyActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `${label} copied` : label}
      title={copied ? `${label} copied` : label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
        copied
          ? "border-[#ffb499] bg-[#ffb499]/12 text-[#ffcfbc]"
          : "border-white/12 bg-white/[0.04] text-white/72 hover:border-[#ffb499] hover:text-white"
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="sr-only">{copied ? `${label} copied` : label}</span>
    </button>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-xs uppercase tracking-[0.2em] text-white/70"
    >
      {children}
    </label>
  );
}

export function FieldLabelWithInfo({
  children,
  htmlFor,
  info,
}: {
  children: string;
  htmlFor?: string;
  info: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <div className="group relative">
        <button
          type="button"
          aria-label={`${children} info`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white/46 transition hover:text-[#ffb499] focus-visible:text-[#ffb499] focus-visible:outline-none"
        >
          <InfoIcon />
        </button>
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-[0.9rem] border border-white/12 bg-[#1e1e1e] p-3 text-[11px] leading-5 text-white/75 shadow-[0_18px_40px_rgba(0,0,0,0.35)] group-hover:block group-focus-within:block">
          {info}
        </div>
      </div>
    </div>
  );
}

export function ErrorMessage({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <p className="rounded-2xl border border-[#ffb499]/20 bg-[#ffb499]/10 px-4 py-3 text-sm text-[#9f4b2f]">
      {error}
    </p>
  );
}

export function StatusPill({ status }: { status: ShortStatus }) {
  const copy =
    status === "completed"
      ? "Completed"
      : status === "failed"
        ? "Failed"
        : status === "queued"
          ? "Queued"
          : "Rendering";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${
        status === "completed"
          ? "border-[#86d0a0]/30 bg-[#86d0a0]/10 text-[#b4f2ca]"
          : status === "failed"
            ? "border-[#ffb499]/30 bg-[#ffb499]/10 text-[#ffcfbc]"
            : "border-[#f6b26b]/30 bg-[#f6b26b]/10 text-[#ffd7ad]"
      }`}
    >
      {copy}
    </span>
  );
}

export function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-[1rem] border border-dashed border-panel-border/80 bg-white/40 px-4 py-5">
      <p className="max-w-md text-sm leading-7 text-muted">{copy}</p>
    </div>
  );
}

export function MediumIdleState() {
  return (
    <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
      <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.04] p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
          Medium Preview
        </p>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
          Ready for one finished draft
        </h3>
        <p className="mt-3 max-w-lg text-sm leading-7 text-white/60">
          Generate a story to preview the full article, lead image, and
          Medium-ready formatting in this pane.
        </p>
      </div>
    </div>
  );
}

export function MediumLoadingState() {
  return (
    <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
      <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffb499]/25 bg-[#ffb499]/10"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ffb499]/30 border-t-[#ffb499]" />
          </span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
              Medium Draft
            </p>
            <p className="mt-1 text-sm text-white/68">
              Writing your story and preparing the preview.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1rem] border border-white/8 bg-[#f8f2e8] p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-44 rounded-[1rem] bg-[#ead8c2]" />
            <div className="h-8 w-3/4 rounded-full bg-[#ead8c2]" />
            <div className="space-y-3">
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-5/6 rounded-full bg-[#ead8c2]" />
            </div>
            <div className="space-y-3 pt-3">
              <div className="h-5 w-1/3 rounded-full bg-[#ead8c2]" />
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-11/12 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-4/5 rounded-full bg-[#ead8c2]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComposerPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <div aria-hidden={!active} className={active ? "block" : "hidden"}>{children}</div>;
}

export function SidebarWorkspaceButton({
  workspace,
  label,
  helper,
  active,
  collapsed,
  onSelect,
}: {
  workspace: WorkspaceId;
  label: string;
  helper: string;
  active: boolean;
  collapsed: boolean;
  onSelect: (workspace: WorkspaceId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(workspace)}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`w-full rounded-[1.1rem] border text-left transition ${
        collapsed ? "px-0 py-3" : "px-3.5 py-3"
      } ${
        active
          ? "border-[#171717] bg-[#171717] text-white shadow-[0_16px_36px_rgba(23,23,23,0.14)]"
          : "border-panel-border bg-white/50 text-[#171717] hover:bg-white/80"
      }`}
    >
      <div
        className={`flex gap-3 ${
          collapsed ? "items-center justify-center" : "items-start"
        }`}
      >
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
            active
              ? "border-white/14 bg-white/[0.06] text-[#ffb499]"
              : "border-panel-border bg-white/85 text-accent"
          }`}
        >
          <WorkspaceIcon workspace={workspace} />
        </span>
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#c7522a]">
              {label}
            </p>
            <p
              className={`mt-1 text-sm leading-6 ${
                active ? "text-white/70" : "text-muted"
              }`}
            >
              {helper}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
