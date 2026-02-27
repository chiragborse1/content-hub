export type ContentStatus = "Saved" | "Editing" | "Ready" | "Posted";

export interface SavedContent {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  thumbnail: string | null;
  original_caption: string | null;
  edited_caption: string | null;
  notes: string | null;
  status: ContentStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const STATUS_OPTIONS: ContentStatus[] = ["Saved", "Editing", "Ready", "Posted"];
