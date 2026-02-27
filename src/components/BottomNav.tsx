import { Home, PlusCircle, Settings, CheckSquare } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: PlusCircle, label: "Add", path: "/add" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background" style={{ boxShadow: "0 -1px 0 rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
