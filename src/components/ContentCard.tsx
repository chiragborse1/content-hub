import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, FileText, Pencil, Loader2, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_OPTIONS, type SavedContent, type ContentStatus } from "@/types/content";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ContentCard({
  item,
  onUpdate,
}: {
  item: SavedContent;
  onUpdate?: (updated: SavedContent) => void;
}) {
  const navigate = useNavigate();
  const [extracting, setExtracting] = useState(false);
  const [thumb, setThumb] = useState(item.thumbnail);
  const [status, setStatus] = useState<ContentStatus>(item.status as ContentStatus);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // ── Extract Caption ─────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (extracting) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-caption", {
        body: { id: item.id },
      });

      if (error) {
        let msg = "Extraction failed.";
        try {
          const parsed = JSON.parse(error.message);
          if (parsed?.error) msg = parsed.error;
        } catch {
          msg = error.message || msg;
        }
        toast.error(msg);
        return;
      }

      if (data?.error) { toast.error(data.error); return; }

      const updated = data?.data as SavedContent;
      if (updated) {
        if (updated.thumbnail) setThumb(updated.thumbnail);
        onUpdate?.(updated);
      }

      toast.success(data?.extracted === false ? "No caption found." : "Caption extracted!");
    } catch {
      toast.error("Unexpected error during extraction.");
    } finally {
      setExtracting(false);
    }
  };

  // ── Quick Status Change ──────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: ContentStatus) => {
    setStatusOpen(false);
    if (newStatus === status) return;
    setSavingStatus(true);
    const prev = status;
    setStatus(newStatus); // optimistic
    const { error } = await supabase
      .from("saved_content")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (error) {
      toast.error("Failed to update status.");
      setStatus(prev);
    } else {
      onUpdate?.({ ...item, status: newStatus });
      toast.success(`Moved to ${newStatus}`);
    }
    setSavingStatus(false);
  };

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors animate-fade-in"
      onClick={() => navigate(`/content/${item.id}`)}
    >
      {/* Thumbnail — clicks open the Instagram URL */}
      <div
        className="aspect-video bg-secondary flex items-center justify-center overflow-hidden relative group"
        onClick={(e) => { e.stopPropagation(); window.open(item.url, "_blank", "noopener,noreferrer"); }}
      >
        {thumb ? (
          <img src={thumb} alt={item.title || "Content"} className="w-full h-full object-cover" />
        ) : (
          <ExternalLink className="w-8 h-8 text-muted-foreground/40" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-white" />
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title & Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1">
            {item.title || "Untitled"}
          </h3>
          <StatusBadge status={status as any} />
        </div>

        {/* URL */}
        <p className="font-mono text-muted-foreground truncate text-xs">{item.url}</p>

        {/* Date */}
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.created_at), "MMM d, yyyy")}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>

          {/* Extract */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            disabled={extracting}
            onClick={handleExtract}
          >
            {extracting ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <FileText className="w-3 h-3 mr-1" />
            )}
            {extracting ? "Extracting…" : "Extract"}
          </Button>

          {/* Status picker */}
          <div className="relative flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 justify-between"
              disabled={savingStatus}
              onClick={() => setStatusOpen((o) => !o)}
            >
              <span className="truncate">{status}</span>
              <ChevronDown className="w-3 h-3 ml-1 flex-shrink-0" />
            </Button>

            {statusOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-full rounded-md border border-border bg-popover shadow-lg py-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${s === status ? "text-primary font-medium" : "text-foreground"}`}
                    onClick={() => handleStatusChange(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edit */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => navigate(`/content/${item.id}`)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
