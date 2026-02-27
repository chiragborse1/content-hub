import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, FileText, Loader2, ChevronDown, Trash2 } from "lucide-react";
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
  onDelete,
}: {
  item: SavedContent;
  onUpdate?: (updated: SavedContent) => void;
  onDelete?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [extracting, setExtracting] = useState(false);
  const [thumb, setThumb] = useState(item.thumbnail);
  const [status, setStatus] = useState<ContentStatus>(item.status as ContentStatus);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        try { const p = JSON.parse(error.message); if (p?.error) msg = p.error; } catch { msg = error.message || msg; }
        toast.error(msg); return;
      }
      if (data?.error) { toast.error(data.error); return; }
      const updated = data?.data as SavedContent;
      if (updated) { if (updated.thumbnail) setThumb(updated.thumbnail); onUpdate?.(updated); }
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
    setStatus(newStatus);
    const { error } = await supabase.from("saved_content").update({ status: newStatus }).eq("id", item.id);
    if (error) { toast.error("Failed to update status."); setStatus(prev); }
    else { onUpdate?.({ ...item, status: newStatus }); toast.success(`Moved to ${newStatus}`); }
    setSavingStatus(false);
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this item? This cannot be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("saved_content").delete().eq("id", item.id);
    if (error) { toast.error("Failed to delete."); setDeleting(false); return; }
    toast.success("Removed.");
    onDelete?.(item.id);
  };

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors animate-fade-in flex"
      onClick={() => navigate(`/content/${item.id}`)}
    >
      {/* Thumbnail (Left side) */}
      <div
        className="w-24 shrink-0 aspect-[9/16] bg-secondary flex items-center justify-center overflow-hidden relative border-r border-border"
        onClick={(e) => { e.stopPropagation(); window.open(item.url, "_blank", "noopener,noreferrer"); }}
      >
        {thumb ? (
          <img src={thumb} alt={item.title || "Content"} className="w-full h-full object-cover" />
        ) : (
          <ExternalLink className="w-6 h-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Content (Right side) */}
      <CardContent className="p-3.5 flex flex-col justify-between flex-1 min-w-0">
        <div className="space-y-1.5">
          {/* Title & Status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{item.title || "Untitled"}</h3>
            <StatusBadge status={status as any} />
          </div>

          {/* Date */}
          <p className="text-[11px] text-muted-foreground">{format(new Date(item.created_at), "MMM d, yyyy")}</p>
        </div>

        {/* Action buttons (Bottom right) */}
        <div className="flex gap-1.5 mt-4" onClick={(e) => e.stopPropagation()}>
          {/* Extract */}
          <Button variant="outline" size="sm" className="flex-1 text-[11px] h-7 px-2" disabled={extracting} onClick={handleExtract}>
            {extracting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
            {extracting ? "Extracting…" : "Extract"}
          </Button>

          {/* Status picker */}
          <div className="relative flex-1">
            <Button variant="outline" size="sm" className="w-full text-[11px] h-7 px-2 justify-between" disabled={savingStatus} onClick={() => setStatusOpen((o) => !o)}>
              <span className="truncate">{status}</span>
              <ChevronDown className="w-3 h-3 ml-0.5 flex-shrink-0" />
            </Button>
            {statusOpen && (
              <div className="absolute bottom-full mb-1 right-0 z-50 w-32 rounded-md border border-border bg-popover shadow-lg py-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${s === status ? "text-primary font-medium" : "text-foreground"}`}
                    onClick={() => handleStatusChange(s)}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <Button
            variant="outline"
            size="sm"
            className="w-7 h-7 p-0 shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
