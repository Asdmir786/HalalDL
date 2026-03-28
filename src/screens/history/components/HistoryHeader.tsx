import {
  CheckCircle2,
  Filter,
  History,
  LayoutGrid,
  LayoutList,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { MotionButton } from "@/components/motion/MotionButton";
import { cn } from "@/lib/utils";
import { FadeInItem } from "@/components/motion/StaggerContainer";

export type StatusFilter = "all" | "completed" | "failed";
export type DateFilter = "all" | "24h" | "today" | "week" | "month";
export type SortOrder = "newest" | "oldest" | "largest";
export type ViewMode = "list" | "grid";

interface HistoryHeaderProps {
  totalCount: number;
  filteredCount: number;
  completedCount: number;
  failedCount: number;
  selectedCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (v: DateFilter) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (v: SortOrder) => void;
  hideMissing: boolean;
  onHideMissingChange: (v: boolean) => void;
  groupByDomain: boolean;
  onGroupByDomainChange: (v: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onClearAll: () => void;
  children?: React.ReactNode;
}

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "24h", label: "Last 24h" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "largest", label: "Largest" },
];

export function HistoryHeader({
  totalCount, filteredCount, completedCount, failedCount, selectedCount, search, onSearchChange,
  statusFilter, onStatusFilterChange,
  dateFilter, onDateFilterChange,
  sortOrder, onSortOrderChange,
  hideMissing, onHideMissingChange,
  groupByDomain, onGroupByDomainChange,
  viewMode, onViewModeChange,
  onClearAll,
  children,
}: HistoryHeaderProps) {
  const activeFilterCount = [
    statusFilter !== "all",
    dateFilter !== "all",
    sortOrder !== "newest",
    hideMissing,
    groupByDomain,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <FadeInItem className="rounded-[28px] border border-border/40 bg-[linear-gradient(135deg,rgba(17,24,39,0.72),rgba(10,15,27,0.94))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.22)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/90">
                <History className="h-3.5 w-3.5" />
                Archive
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">History</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Review finished jobs, grab files again fast, and rerun anything worth keeping.
                </p>
              </div>
            </div>

            {totalCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="flex items-center rounded-full border border-border/50 bg-background/40 p-1">
                  <button
                    onClick={() => onViewModeChange("list")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                      viewMode === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="List view"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutList className="h-3.5 w-3.5" />
                      List
                    </span>
                  </button>
                  <button
                    onClick={() => onViewModeChange("grid")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                      viewMode === "grid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Grid view"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Grid
                    </span>
                  </button>
                </div>
                {children}
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={onClearAll}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Archive
                </MotionButton>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryPill
              label="Archived"
              value={String(totalCount)}
              detail={totalCount === 0 ? "Nothing saved yet" : "Total stored jobs"}
            />
            <SummaryPill
              label="Showing"
              value={String(filteredCount)}
              detail={activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : "Current view"}
            />
            <SummaryPill
              label="Completed"
              value={String(completedCount)}
              detail="Ready to reopen or copy"
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
            />
            <SummaryPill
              label="Failed"
              value={String(failedCount)}
              detail={selectedCount > 0 ? `${selectedCount} selected` : "Available for retry"}
              icon={<XCircle className="h-3.5 w-3.5 text-rose-400" />}
            />
          </div>
        </div>
      </FadeInItem>

      {totalCount > 0 && (
        <FadeInItem className="rounded-2xl border border-border/40 bg-card/35 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search titles, links, or sources"
                  className="h-11 rounded-xl border-border/40 bg-background/55 pl-10 pr-9"
                />
                {search && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 rounded-md p-1 -translate-y-1/2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                {activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                  : "All results visible"}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.1fr_1.1fr_0.9fr_1fr]">
              <FilterSection label="Status">
                {STATUS_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.id}
                    label={opt.label}
                    active={statusFilter === opt.id}
                    onClick={() => onStatusFilterChange(opt.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection label="When">
                {DATE_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.id}
                    label={opt.label}
                    active={dateFilter === opt.id}
                    onClick={() => onDateFilterChange(opt.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection label="Order">
                {SORT_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.id}
                    label={opt.label}
                    active={sortOrder === opt.id}
                    onClick={() => onSortOrderChange(opt.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection label="Options">
                <FilterChip
                  label="By source"
                  active={groupByDomain}
                  onClick={() => onGroupByDomainChange(!groupByDomain)}
                />
                <FilterChip
                  label="Hide missing"
                  active={hideMissing}
                  onClick={() => onHideMissingChange(!hideMissing)}
                />
              </FilterSection>
            </div>
          </div>
        </FadeInItem>
      )}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/35 px-3 py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/35 bg-background/35 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 cursor-pointer",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
