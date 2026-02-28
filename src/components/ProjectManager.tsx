import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Github, Plus, Trash2, Edit2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Project, ProjectStatus } from "@/types/project";
import { PROJECT_STATUS_OPTIONS } from "@/types/project";

export function ProjectManager() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newStatus, setNewStatus] = useState<ProjectStatus>("Going To Work On");
    const [newGithub, setNewGithub] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchProjects();

        const channel = supabase
            .channel("projects_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "projects" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setProjects((prev) => [payload.new as Project, ...prev]);
                    } else if (payload.eventType === "UPDATE") {
                        setProjects((prev) =>
                            prev.map((p) => (p.id === payload.new.id ? (payload.new as Project) : p))
                        );
                    } else if (payload.eventType === "DELETE") {
                        setProjects((prev) => prev.filter((p) => p.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setProjects((data as Project[]) || []);
        } catch (error) {
            console.error("Error fetching projects:", error);
            toast.error("Failed to load projects");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            setSubmitting(true);
            const { error } = await supabase.from("projects").insert({
                name: newName.trim(),
                status: newStatus,
                github_url: newGithub.trim() || null,
            });

            if (error) throw error;
            toast.success("Project added successfully!");

            // Reset form
            setNewName("");
            setNewStatus("Going To Work On");
            setNewGithub("");
            setIsAdding(false);
        } catch (error) {
            console.error("Error adding project:", error);
            toast.error("Failed to add project");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: ProjectStatus) => {
        try {
            const { error } = await supabase
                .from("projects")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw error;
            toast.success("Status updated!");
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project?")) return;

        try {
            const { error } = await supabase.from("projects").delete().eq("id", id);
            if (error) throw error;
            toast.success("Project deleted");
        } catch (error) {
            console.error("Error deleting project:", error);
            toast.error("Failed to delete project");
        }
    };

    const getStatusColor = (status: ProjectStatus) => {
        switch (status) {
            case "Going To Work On": return "bg-blue-500/20 text-blue-400";
            case "Working On": return "bg-amber-500/20 text-amber-400";
            case "Under Testing": return "bg-purple-500/20 text-purple-400";
            case "Done": return "bg-emerald-500/20 text-emerald-400";
            default: return "bg-secondary text-secondary-foreground";
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Projects</h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAdding(!isAdding)}
                    className="gap-2"
                >
                    {isAdding ? "Cancel" : <><Plus className="w-4 h-4" /> Add Project</>}
                </Button>
            </div>

            {isAdding && (
                <form onSubmit={handleCreateProject} className="bg-card border border-border rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <Label htmlFor="projectName">Project Name *</Label>
                        <Input
                            id="projectName"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Creator Hub"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ProjectStatus)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROJECT_STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="githubUrl">GitHub URL (Optional)</Label>
                        <div className="relative">
                            <Github className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="githubUrl"
                                type="url"
                                value={newGithub}
                                onChange={(e) => setNewGithub(e.target.value)}
                                placeholder="https://github.com/..."
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Project"}
                    </Button>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : projects.length === 0 && !isAdding ? (
                <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed border-border">
                    <p className="text-sm">No projects yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map((project) => (
                        <div key={project.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 group">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(project.id)}
                                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <Select
                                    value={project.status}
                                    onValueChange={(value) => handleUpdateStatus(project.id, value as ProjectStatus)}
                                >
                                    <SelectTrigger className={`h-8 text-xs font-semibold border-none w-auto gap-2 ${getStatusColor(project.status)}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROJECT_STATUS_OPTIONS.map((status) => (
                                            <SelectItem key={status} value={status} className="text-xs">
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {project.github_url && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                        asChild
                                    >
                                        <a href={project.github_url} target="_blank" rel="noopener noreferrer" title="View on GitHub">
                                            <Github className="w-4 h-4" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
