import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { BottomNav } from "@/components/BottomNav";
import type { SavedContent, ContentStatus } from "@/types/content";
import { STATUS_OPTIONS } from "@/types/content";
import { Loader2, Wifi } from "lucide-react";

export default function Dashboard() {
  const [items, setItems] = useState<SavedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentStatus | "All">("All");
  const [connected, setConnected] = useState(false);

  // ── Fetch all items (called on mount + filter change) ──────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("saved_content")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "All") query = query.eq("status", filter);

    const { data } = await query;
    setItems((data as SavedContent[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("saved_content_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_content" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT") {
            const inserted = newRow as SavedContent;
            // Only add to list if it passes the current filter
            if (filter === "All" || inserted.status === filter) {
              setItems((prev) => [inserted, ...prev]);
            }
          }

          if (eventType === "UPDATE") {
            const updated = newRow as SavedContent;
            setItems((prev) => {
              const exists = prev.find((i) => i.id === updated.id);
              if (!exists) {
                // Item wasn't visible — add it if it passes filter
                if (filter === "All" || updated.status === filter) {
                  return [updated, ...prev];
                }
                return prev;
              }
              // Filter check: if status changed and now doesn't match, remove it
              if (filter !== "All" && updated.status !== filter) {
                return prev.filter((i) => i.id !== updated.id);
              }
              return prev.map((i) => (i.id === updated.id ? updated : i));
            });
          }

          if (eventType === "DELETE") {
            const deleted = oldRow as { id: string };
            setItems((prev) => prev.filter((i) => i.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Creator Hub</h1>
        {/* Realtime indicator */}
        <div className={`flex items-center gap-1.5 text-xs ${connected ? "text-emerald-400" : "text-muted-foreground"}`}>
          <Wifi className="w-3.5 h-3.5" />
          <span>{connected ? "Live" : "Connecting…"}</span>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {["All", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as any)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No content yet</p>
            <p className="text-sm mt-1">Add your first link to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                onUpdate={(updated) =>
                  setItems((prev) =>
                    prev.map((i) => (i.id === updated.id ? updated : i))
                  )
                }
                onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
