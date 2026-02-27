import { useState, useEffect, useCallback } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Plus, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
    id: string;
    text: string;
    done: boolean;
    created_at: string;
    done_at: string | null;
}

function fmtDate(ts: string | null | undefined) {
    if (!ts) return null;
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return format(d, "MMM d, yyyy");
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [input, setInput] = useState("");

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) toast.error("Failed to load tasks.");
        else setTasks((data as Task[]) || []);
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // ── Add ───────────────────────────────────────────────────────────────────
    const addTask = async () => {
        const text = input.trim();
        if (!text) return;
        setInput("");
        const { data, error } = await supabase
            .from("tasks")
            .insert({ text, done: false })
            .select()
            .single();
        if (error) { toast.error("Failed to add task."); return; }
        setTasks((prev) => [data as Task, ...prev]);
    };

    // ── Toggle done ───────────────────────────────────────────────────────────
    const toggleTask = async (task: Task) => {
        const newDone = !task.done;
        const done_at = newDone ? new Date().toISOString() : null;
        // optimistic
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: newDone, done_at } : t));
        const { error } = await supabase
            .from("tasks")
            .update({ done: newDone, done_at })
            .eq("id", task.id);
        if (error) {
            toast.error("Failed to update task.");
            setTasks((prev) => prev.map((t) => t.id === task.id ? task : t)); // revert
        }
    };

    // ── Delete one ────────────────────────────────────────────────────────────
    const deleteTask = async (id: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) { toast.error("Failed to delete task."); fetchTasks(); }
        else toast.success("Task removed.");
    };

    // ── Delete all ────────────────────────────────────────────────────────────
    const deleteAll = async () => {
        if (!confirm("Delete ALL tasks? This cannot be undone.")) return;
        const { error } = await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) { toast.error("Failed to clear tasks."); return; }
        setTasks([]);
        toast.success("All tasks cleared.");
    };

    const pending = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-4 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Tasks</h1>
                    {tasks.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {pending.length} remaining · {done.length} done
                        </p>
                    )}
                </div>
                {tasks.length > 0 && (
                    <button
                        onClick={deleteAll}
                        className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity mt-1"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear all
                    </button>
                )}
            </header>

            <div className="max-w-lg mx-auto p-4 space-y-6">

                {/* Add task input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addTask()}
                        placeholder="Add a new task…"
                        className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                        onClick={addTask}
                        disabled={!input.trim()}
                        className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity shrink-0"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Pending tasks */}
                {pending.length > 0 && (
                    <div className="space-y-2">
                        {pending.map((task) => (
                            <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                        ))}
                    </div>
                )}

                {/* Completed tasks */}
                {done.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Completed</p>
                        {done.map((task) => (
                            <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                        ))}
                    </div>
                )}

                {tasks.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No tasks yet</p>
                        <p className="text-sm mt-1">Add something to get started</p>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}

function TaskRow({
    task,
    onToggle,
    onDelete,
}: {
    task: Task;
    onToggle: (task: Task) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${task.done ? "border-border/40 bg-card/50" : "border-border bg-card"}`}>
            {/* Toggle */}
            <button onClick={() => onToggle(task)} className="shrink-0 mt-0.5">
                {task.done
                    ? <CheckCircle2 className="w-5 h-5 text-primary" />
                    : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                }
            </button>

            {/* Text + dates */}
            <div className="flex-1 min-w-0">
                <span className={`text-sm leading-snug block ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.text}
                </span>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground/60">
                        Added {fmtDate(task.created_at)}
                    </span>
                    {task.done && task.done_at && (
                        <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-primary/70">Done {fmtDate(task.done_at)}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Delete — always visible */}
            <button
                onClick={() => onDelete(task.id)}
                className="shrink-0 mt-0.5 text-muted-foreground hover:text-destructive transition-colors"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}
