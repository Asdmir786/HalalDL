import { History, Search, Trash2, X, LayoutGrid, LayoutList } from "lucide-react";
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
  totalCount, search, onSearchChange,
  statusFilter, onStatusFilterChange,
  dateFilter, onDateFilterChange,
  sortOrder, onSortOrderChange,
  hideMissing, onHideMissingChange,
  groupByDomain, onGroupByDomainChange,
  viewMode, onViewModeChange,
  onClearAll,
  children,
}: HistoryHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <FadeInItem className="flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <History className="w-8 h-8 text-primary" />
              History
            </h2>
            <p className="text-muted-foreground">
              {totalCount === 0
                ? "No downloads archived yet."
                : `${totalCount} download${totalCount === 1 ? "" : "s"} archived.`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <div className="flex items-center p-1 bg-muted/30 rounded-lg border border-border/50">
              <button
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="List View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange("grid")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            )}
            {totalCount > 0 && (
              <>
                {children}
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={onClearAll}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </MotionButton>
              </>
            )}
          </div>
        </div>
      </FadeInItem>

      {totalCount > 0 && (
        <FadeInItem className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title or URL..."
              className="pl-9 pr-8 bg-muted/30"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={statusFilter === opt.id}
                  onClick={() => onStatusFilterChange(opt.id)}
                />
              ))}
            </div>

            <span className="w-px h-5 bg-border" />

            <div className="flex items-center gap-1">
              {DATE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={dateFilter === opt.id}
                  onClick={() => onDateFilterChange(opt.id)}
                />
              ))}
            </div>

            <span className="w-px h-5 bg-border" />

            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={sortOrder === opt.id}
                  onClick={() => onSortOrderChange(opt.id)}
                />
              ))}
            </div>

            <span className="w-px h-5 bg-border" />

            <div className="flex items-center gap-1">
              <FilterChip
                label="Group by domain"
                active={groupByDomain}
                onClick={() => onGroupByDomainChange(!groupByDomain)}
              />
              <FilterChip
                label="Hide missing"
                active={hideMissing}
                onClick={() => onHideMissingChange(!hideMissing)}
              />
            </div>
          </div>
        </FadeInItem>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
