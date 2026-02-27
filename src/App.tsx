import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import AddContent from "@/pages/AddContent";
import ContentDetail from "@/pages/ContentDetail";
import SettingsPage from "@/pages/SettingsPage";
import TasksPage from "@/pages/TasksPage";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddContent />} />
          <Route path="/content/:id" element={<ContentDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tasks" element={<TasksPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
