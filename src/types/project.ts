export type ProjectStatus = "Going To Work On" | "Working On" | "Under Testing" | "Done";

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
    "Going To Work On",
    "Working On",
    "Under Testing",
    "Done",
];

export interface Project {
    id: string;
    name: string;
    status: ProjectStatus;
    github_url: string | null;
    created_at: string;
}
