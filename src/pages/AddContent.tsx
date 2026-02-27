import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Single-user mode: a fixed placeholder UUID used as user_id for all records.
// This keeps the DB schema intact (user_id NOT NULL) without requiring auth.
const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

export default function AddContent() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("saved_content").insert({
      user_id: SINGLE_USER_ID,
      url: url.trim(),
      title: title.trim() || null,
    });
    if (error) {
      toast.error("Failed to save content");
    } else {
      toast.success("Content saved!");
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Add Content</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="space-y-2">
          <Label htmlFor="url">URL *</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/p/..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Content title"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving..." : "Save Content"}
        </Button>
      </form>

      <BottomNav />
    </div>
  );
}
