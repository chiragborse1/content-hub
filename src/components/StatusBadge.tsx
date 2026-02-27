import { Badge } from "@/components/ui/badge";
import type { ContentStatus } from "@/types/content";

const statusColors: Record<ContentStatus, string> = {
  Saved: "bg-secondary text-secondary-foreground",
  Editing: "bg-amber-500/15 text-amber-400",
  Ready: "bg-emerald-500/15 text-emerald-400",
  Posted: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge variant="outline" className={`border-0 text-xs font-medium ${statusColors[status]}`}>
      {status}
    </Badge>
  );
}
