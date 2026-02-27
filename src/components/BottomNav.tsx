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

  const activeIndex = navItems.findIndex(item => item.path === location.pathname);

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 pointer-events-none flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <nav className="relative pointer-events-auto flex items-center bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 w-full max-w-[340px] shadow-2xl">

        {/* Sliding Pill Indicator */}
        <div className="absolute inset-y-1.5 left-1.5 right-1.5 pointer-events-none flex">
          <div
            className="w-1/4 h-full bg-white/15 rounded-full shadow-sm transition-transform duration-500"
            style={{
              transform: `translateX(${activeIndex === -1 ? 0 : activeIndex * 100}%)`,
              transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
              opacity: activeIndex === -1 ? 0 : 1
            }}
          />
        </div>

        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 h-[54px] rounded-full transition-colors duration-300 ${active
                ? "text-white"
                : "text-white/50 hover:text-white/80"
                }`}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
