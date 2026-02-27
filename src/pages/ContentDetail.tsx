import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomNav } from "@/components/BottomNav";
import { STATUS_OPTIONS, type SavedContent, type ContentStatus } from "@/types/content";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, Loader2, Copy, Check } from "lucide-react";


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy caption"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}


export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<SavedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [originalCaption, setOriginalCaption] = useState("");
  const [editedCaption, setEditedCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ContentStatus>("Saved");
  const [tagsStr, setTagsStr] = useState("");

  useEffect(() => {
    if (!id) return;
    supabase
      .from("saved_content")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as SavedContent;
          setItem(d);
          setTitle(d.title || "");
          setOriginalCaption(d.original_caption || "");
          setEditedCaption(d.edited_caption || "");
          setNotes(d.notes || "Follow @sci.artistry for more such content");

          setStatus(d.status);
          setTagsStr((d.tags || []).join(", "));
        }
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("saved_content")
      .update({
        title: title || null,
        original_caption: originalCaption || null,
        edited_caption: editedCaption || null,
        notes: notes || null,
        status,
        tags,
      })
      .eq("id", id);

    if (error) toast.error("Failed to save");
    else { toast.success("Saved!"); navigate("/"); }

    setSaving(false);
  };

  // ── Extract Caption ─────────────────────────────────────────────────────────
  const handleExtractCaption = async () => {
    if (!id || extracting) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "extract-caption",
        { body: { id } }
      );

      if (error) {
        // error.message may contain the JSON body from the function
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

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const updated = data?.data as SavedContent;
      if (updated) {
        setItem(updated);
        setOriginalCaption(updated.original_caption || "");
        if (updated.thumbnail) {
          // thumbnail state is read from item, no separate state needed
        }
      }

      if (data?.extracted === false) {
        toast.info("No new caption found for this post.");
      } else {
        toast.success("Caption extracted successfully!");
      }
    } catch (err) {
      toast.error("Unexpected error during extraction.");
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Content not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground truncate flex-1">{item.title || "Untitled"}</h1>
        <StatusBadge status={status} />
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* Preview — click opens Instagram URL */}
        <div
          className="aspect-video rounded-lg bg-secondary flex items-center justify-center overflow-hidden relative group cursor-pointer"
          onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
        >
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <ExternalLink className="w-12 h-12 text-muted-foreground/30" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ExternalLink className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* URL */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-mono text-primary hover:underline truncate text-sm"
        >
          {item.url}
        </a>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleExtractCaption}
            disabled={extracting}
          >
            {extracting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {extracting ? "Extracting…" : "Extract Caption"}
          </Button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ContentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Original Caption</Label>
              {originalCaption && (
                <CopyButton text={originalCaption} />
              )}
            </div>
            <Textarea
              value={originalCaption}
              onChange={(e) => setOriginalCaption(e.target.value)}
              rows={4}
              placeholder="Paste original caption here..."
            />
          </div>


          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Notes</Label>
              {notes && <CopyButton text={notes} />}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Follow @sci.artistry for more such content"
            />
          </div>

        </div>

        <Button onClick={handleSave} className="w-full" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
