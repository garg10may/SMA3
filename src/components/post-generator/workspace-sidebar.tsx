"use client";

import { platformOptions } from "@/lib/post-config";
import {
  ChevronLeftIcon,
  SidebarWorkspaceButton,
} from "@/components/post-generator/shared";
import type { WorkspaceId } from "@/components/post-generator/types";

const channelWorkspaces = [
  ...platformOptions,
  {
    value: "shorts",
    label: "Shorts",
    helper:
      "Generate one AI-rendered vertical short plus the upload copy and prompt pack.",
  },
] as const;

const agentWorkspaces = [
  {
    value: "meme",
    label: "Meme Generator",
    helper:
      "Choose a memegen template, write the caption, and preview the result.",
  },
] as const;

export function WorkspaceSidebar({
  workspace,
  sidebarCollapsed,
  onToggleCollapse,
  onSelectWorkspace,
}: {
  workspace: WorkspaceId;
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectWorkspace: (workspace: WorkspaceId) => void;
}) {
  return (
    <aside className="xl:sticky xl:top-6 xl:self-start">
      <section
        className={`rounded-[1.35rem] border border-panel-border bg-panel/80 p-3 shadow-[0_20px_60px_rgba(23,23,23,0.08)] transition-all ${
          sidebarCollapsed ? "xl:w-[5.75rem]" : "xl:w-[18.5rem]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={sidebarCollapsed ? "xl:hidden" : ""}>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#c7522a]">
              Workspace
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#171717]">
              Channels and agents
            </h2>
            <p className="mt-1 max-w-[14rem] text-sm leading-6 text-muted">
              Switch between publishing channels and internal generators from
              one rail.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-panel-border bg-white/70 text-[#171717] transition hover:bg-white xl:inline-flex"
          >
            <span
              className={sidebarCollapsed ? "rotate-180 transition" : "transition"}
            >
              <ChevronLeftIcon />
            </span>
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div className="space-y-2.5">
            {sidebarCollapsed ? null : (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Channels
              </p>
            )}
            {channelWorkspaces.map((option) => (
              <SidebarWorkspaceButton
                key={option.value}
                workspace={option.value}
                label={option.label}
                helper={option.helper}
                active={workspace === option.value}
                collapsed={sidebarCollapsed}
                onSelect={onSelectWorkspace}
              />
            ))}
          </div>

          <div className="space-y-2.5">
            {sidebarCollapsed ? null : (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Agents
              </p>
            )}
            {agentWorkspaces.map((option) => (
              <SidebarWorkspaceButton
                key={option.value}
                workspace={option.value}
                label={option.label}
                helper={option.helper}
                active={workspace === option.value}
                collapsed={sidebarCollapsed}
                onSelect={onSelectWorkspace}
              />
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
