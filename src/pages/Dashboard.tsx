import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { BottomNav } from "@/components/BottomNav";
import type { SavedContent, ContentStatus } from "@/types/content";
import { STATUS_OPTIONS } from "@/types/content";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const [items, setItems] = useState<SavedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentStatus | "All">("All");

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      let query = supabase
        .from("saved_content")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "All") {
        query = query.eq("status", filter);
      }

      const { data } = await query;
      setItems((data as SavedContent[]) || []);
      setLoading(false);
    };
    fetchItems();
  }, [filter]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Creator Hub</h1>
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
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
