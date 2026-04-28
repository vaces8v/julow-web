"use client";

import { useState } from "react";
import { Button, Chip, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  File02Icon,
  FileDownloadIcon,
  FolderOpenIcon,
  Folder02Icon,
  GridViewIcon,
  Menu01Icon,
  Search01Icon,
} from "hugeicons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n/context";

type ViewMode = "grid" | "list";

type FolderNode = {
  id: string;
  name: string;
  children?: FolderNode[];
};

const tree: FolderNode[] = [
  {
    id: "product", name: "Product", children: [
      { id: "product-prd", name: "PRDs" },
      { id: "product-design", name: "Design Specs" },
    ],
  },
  {
    id: "engineering", name: "Engineering", children: [
      { id: "eng-api", name: "API Docs" },
      { id: "eng-arch", name: "Architecture" },
      { id: "eng-runbooks", name: "Runbooks" },
    ],
  },
  {
    id: "operations", name: "Operations", children: [
      { id: "ops-onboard", name: "Onboarding" },
      { id: "ops-security", name: "Security" },
    ],
  },
  { id: "releases", name: "Releases" },
];

const allFiles = [
  { id: 1, name: "Product Requirements v2", folder: "product", updated: "2h ago", author: "Alexey", size: "24 KB", ext: "doc", pinned: true },
  { id: 2, name: "API Specification v3", folder: "engineering", updated: "5h ago", author: "Marina", size: "156 KB", ext: "md", pinned: false },
  { id: 3, name: "Sprint Retrospective", folder: "operations", updated: "1d ago", author: "Denis", size: "12 KB", ext: "doc", pinned: false },
  { id: 4, name: "Architecture Decision Log", folder: "engineering", updated: "2d ago", author: "Alexey", size: "48 KB", ext: "md", pinned: true },
  { id: 5, name: "Onboarding Guide", folder: "operations", updated: "3d ago", author: "Olga", size: "32 KB", ext: "pdf", pinned: false },
  { id: 6, name: "Release Notes v2.4", folder: "releases", updated: "4d ago", author: "Marina", size: "8 KB", ext: "md", pinned: false },
  { id: 7, name: "Testing Strategy", folder: "engineering", updated: "1w ago", author: "Denis", size: "20 KB", ext: "doc", pinned: false },
  { id: 8, name: "Incident Response Guide", folder: "operations", updated: "1w ago", author: "Pavel", size: "34 KB", ext: "pdf", pinned: false },
  { id: 9, name: "Figma Prototype Links", folder: "product", updated: "2w ago", author: "Marina", size: "4 KB", ext: "txt", pinned: false },
  { id: 10, name: "Database Schema v5", folder: "engineering", updated: "2w ago", author: "Alexey", size: "64 KB", ext: "md", pinned: false },
];

const EXT_COLORS: Record<string, string> = {
  doc: "bg-blue-500/10 text-blue-600",
  md: "bg-violet-500/10 text-violet-600",
  pdf: "bg-red-500/10 text-red-500",
  txt: "bg-slate-500/10 text-slate-500",
};

function FolderTreeItem({
  node,
  depth = 0,
  active,
  onSelect,
}: {
  node: FolderNode;
  depth?: number;
  active: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = !!node.children?.length;
  const isActive = active === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) setOpen((v) => !v);
        }}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
          isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-muted hover:bg-[var(--surface-secondary)] hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          open ? (
            <FolderOpenIcon size={14} strokeWidth={1.8} className="shrink-0" />
          ) : (
            <Folder02Icon size={14} strokeWidth={1.8} className="shrink-0" />
          )
        ) : (
          <Folder02Icon size={14} strokeWidth={1.8} className="shrink-0 opacity-60" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && open &&
        node.children!.map((child) => (
          <FolderTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            active={active}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function DocumentsPage() {
  const { t } = useI18n();
  const doc = t.documents;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeFolder, setActiveFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filteredFiles = allFiles.filter((f) => {
    const matchFolder = activeFolder === "all" || f.folder === activeFolder || f.folder.startsWith(activeFolder);
    const matchQuery = !query || f.name.toLowerCase().includes(query.toLowerCase()) || f.author.toLowerCase().includes(query.toLowerCase());
    return matchFolder && matchQuery;
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const activeFolderName = activeFolder === "all"
    ? "All files"
    : tree.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => n.id === activeFolder)?.name ?? activeFolder;

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-0 py-6">
      {/* Top toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight">{doc.title}</h1>
          <Text variant="muted" className="m-0 mt-1 text-sm">{doc.subtitle}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary"><Folder02Icon size={14} />{doc.newFolder}</Button>
          <Button size="sm"><Add01Icon size={14} />{doc.upload}</Button>
        </div>
      </div>

      {/* Manager shell */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]">
        {/* Sidebar tree */}
        <aside className="hidden w-[200px] shrink-0 border-r border-[var(--border)]/60 lg:flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--border)]/60">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{doc.folders}</p>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            {/* All files shortcut */}
            <button
              type="button"
              onClick={() => setActiveFolder("all")}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                activeFolder === "all"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:bg-[var(--surface-secondary)] hover:text-foreground"
              }`}
            >
              <GridViewIcon size={14} strokeWidth={1.8} className="shrink-0" />
              <span>{doc.allFiles}</span>
            </button>
            <div className="my-2 h-px bg-[var(--border)]/40" />
            {tree.map((node) => (
              <FolderTreeItem
                key={node.id}
                node={node}
                active={activeFolder}
                onSelect={setActiveFolder}
              />
            ))}
          </ScrollArea>
          {/* Storage */}
          <div className="border-t border-[var(--border)]/60 px-3 py-3">
            <Text variant="muted" className="m-0 text-[11px]">Storage: 7.2 / 10 GB</Text>
            <div className="mt-1.5 h-1 rounded-full bg-[var(--surface-secondary)]">
              <div className="h-full w-[72%] rounded-full bg-accent" />
            </div>
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Panel toolbar */}
          <div className="flex items-center gap-2 border-b border-[var(--border)]/60 px-4 py-2.5">
            {/* Breadcrumb */}
            <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setActiveFolder("all")}
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                {doc.files}
              </button>
              {activeFolder !== "all" && (
                <>
                  <ArrowRight01Icon size={12} strokeWidth={2} className="shrink-0 text-muted/50" />
                  <span className="truncate font-medium">{activeFolderName}</span>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative flex items-center">
              <Search01Icon size={14} strokeWidth={2} className="absolute left-2.5 text-muted/60 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={doc.searchPlaceholder}
                className="h-8 rounded-lg border border-[var(--border)] bg-transparent pl-8 pr-3 text-xs placeholder:text-muted/50 focus:border-accent/50 focus:outline-none transition-colors w-36 focus:w-52"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)]/60 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <GridViewIcon size={13} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  viewMode === "list" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <Menu01Icon size={13} strokeWidth={1.8} />
              </button>
            </div>

            {selected.size > 0 && (
              <Button size="sm" variant="secondary" className="shrink-0">
                <FileDownloadIcon size={14} />
                {selected.size} selected
              </Button>
            )}
          </div>

          {/* Files area */}
          <ScrollArea className="flex-1">
            {viewMode === "list" ? (
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-[24px_1fr_80px_90px_80px] gap-3 border-b border-[var(--border)]/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                  <span />
                  <span>{doc.colName}</span>
                  <span className="hidden sm:block">{doc.colAuthor}</span>
                  <span>{doc.colModified}</span>
                  <span className="hidden md:block">{doc.colSize}</span>
                </div>
                <div className="divide-y divide-[var(--border)]/30">
                  {filteredFiles.map((file) => {
                    const isSelected = selected.has(file.id);
                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSelect(file.id)}
                        className={`group grid cursor-pointer grid-cols-[24px_1fr_80px_90px_80px] items-center gap-3 px-4 py-3 transition-colors ${
                          isSelected
                            ? "bg-accent/5"
                            : "hover:bg-[var(--surface-secondary)]/40"
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-accent bg-accent text-white"
                              : "border-[var(--border)] opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {isSelected && (
                            <svg width="10" height="8" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M1 4l2.5 2.5L9 1" />
                            </svg>
                          )}
                        </span>
                        {/* Name */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase ${EXT_COLORS[file.ext] ?? "bg-gray-500/10 text-gray-500"}`}>
                            {file.ext}
                          </div>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium">{file.name}</p>
                            {file.pinned && (
                              <span className="text-[10px] text-amber-500 font-medium">Pinned</span>
                            )}
                          </div>
                        </div>
                        <Text variant="muted" className="m-0 hidden text-xs sm:block">{file.author}</Text>
                        <Text variant="muted" className="m-0 text-xs">{file.updated}</Text>
                        <Text variant="muted" className="m-0 hidden text-xs md:block">{file.size}</Text>
                      </div>
                    );
                  })}
                  {filteredFiles.length === 0 && (
                    <div className="py-16 text-center">
                      <File02Icon size={32} strokeWidth={1.4} className="mx-auto mb-3 text-muted/30" />
                      <Text variant="muted" className="m-0 text-sm">{doc.noFiles}</Text>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFiles.map((file) => {
                  const isSelected = selected.has(file.id);
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => toggleSelect(file.id)}
                      className={`group flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-accent/40 bg-accent/5"
                          : "border-[var(--border)]/60 hover:border-[var(--border)] hover:bg-[var(--surface-secondary)]/40"
                      }`}
                    >
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold uppercase ${EXT_COLORS[file.ext] ?? "bg-gray-500/10 text-gray-500"}`}>
                        {file.ext}
                      </div>
                      <p className="m-0 w-full truncate text-sm font-medium">{file.name}</p>
                      <Text variant="muted" className="m-0 mt-1 text-[11px]">{file.author} · {file.updated}</Text>
                      {file.pinned && (
                        <Chip size="sm" color="warning" variant="soft" className="mt-2">{doc.pinned}</Chip>
                      )}
                    </button>
                  );
                })}
                {filteredFiles.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <File02Icon size={32} strokeWidth={1.4} className="mx-auto mb-3 text-muted/30" />
                    <Text variant="muted" className="m-0 text-sm">{doc.noFiles}</Text>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-[var(--border)]/60 px-4 py-2">
            <Text variant="muted" className="m-0 text-[11px]">
              {filteredFiles.length} {filteredFiles.length !== 1 ? doc.colName.toLowerCase() + "s" : doc.colName.toLowerCase()}
              {selected.size > 0 && ` · ${selected.size} ${doc.selected}`}
            </Text>
            <Text variant="muted" className="m-0 text-[11px]">7.2 GB used</Text>
          </div>
        </div>
      </div>
    </div>
  );
}
