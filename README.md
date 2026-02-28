# Creators Hub 🚀

Creator Hub is a progressive web application (PWA) designed to help content creators save, organize, and manage their content ideas, references, and projects from a single centralized dashboard.

## ✨ Features

- **Link Saving & Previews**: Save inspiration links (e.g., from Instagram, TikTok) and keep them organized.
- **Automated Caption Extraction**: Fetch the original caption straight from supported link URLs using a Supabase Edge Function.
- **Status Workflows**: Track the lifecycle of your content ideas through visual statuses: `Saved`, `Editing`, `Ready`, `Posted`.
- **Task Management**: Keep track of your daily or content-specific to-dos with a dedicated tasks page.
- **Projects Manager**: Track the broader projects you're working on, color-code their progress, and store their associated GitHub repository links directly in the Settings.
- **Dark/Light Mode**: Full theme customization to fit your workspace.
- **PWA Ready**: Installable as a native app on mobile and desktop via `manifest.json`.

## 🛠️ Tech Stack

- **Frontend**: [React 18](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) (Icons)
- **State Management**: [React Query (TanStack)](https://tanstack.com/query/latest)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime Subscriptions, Edge Functions)
- **Forms & Validation**: `react-hook-form`, `zod`

## 📦 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/chiragborse1/content-hub.git
cd content-hub
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of your project and add your Supabase connection strings:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Supabase Database Setup
Before running the app, ensure your Supabase database is set up correctly. You need to run the SQL scripts found in `supabase/migrations/` in your Supabase SQL Editor.

Required Tables:
1. `saved_content`
2. `tasks`
3. `projects`

*Note: The app is currently configured for a single-user mode (Row Level Security is disabled for ease of local use).*

### 5. Start the Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## 📡 Edge Functions

This app utilizes Supabase Edge functions (e.g., `extract-caption`) to scrape external metadata. If you make changes to an edge function in `supabase/functions/`, you must redeploy it:

```bash
npx supabase functions deploy extract-caption
```

## 🏗️ Building for Production

To create a production-optimized build:
```bash
npm run build
```
You can preview the built app using:
```bash
npm run preview
```

make sure keep your .env files in .gitignore
