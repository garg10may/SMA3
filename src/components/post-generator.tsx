"use client";

import { useState } from "react";
import { MemeComposer } from "@/components/post-generator/meme-composer";
import { MediumComposer } from "@/components/post-generator/medium-composer";
import { ShortComposer } from "@/components/post-generator/short-composer";
import { ComposerPanel } from "@/components/post-generator/shared";
import type { WorkspaceId } from "@/components/post-generator/types";
import { WorkspaceSidebar } from "@/components/post-generator/workspace-sidebar";
import { XComposer } from "@/components/post-generator/x-composer";
import { DEFAULT_PLATFORM } from "@/lib/post-config";

export function PostGenerator() {
  const [workspace, setWorkspace] = useState<WorkspaceId>(DEFAULT_PLATFORM);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
      <WorkspaceSidebar
        workspace={workspace}
        sidebarCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        onSelectWorkspace={setWorkspace}
      />

      <div className="min-w-0 space-y-4">
        <ComposerPanel active={workspace === "x"}>
          <XComposer />
        </ComposerPanel>
        <ComposerPanel active={workspace === "medium"}>
          <MediumComposer />
        </ComposerPanel>
        <ComposerPanel active={workspace === "shorts"}>
          <ShortComposer />
        </ComposerPanel>
        <ComposerPanel active={workspace === "meme"}>
          <MemeComposer />
        </ComposerPanel>
      </div>
    </div>
  );
}
