import { NavLink, useNavigate } from "react-router-dom";
import {
  Castle,
  BookOpen,
  ScrollText,
  Armchair,
  Eye,
  Coins,
  Archive,
  LogOut,
} from "lucide-react";
import { clearToken } from "../api/auth.store";
import { toast } from "react-toastify";

export default function Sidebar() {
  const navigate = useNavigate();

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: Castle },
    { to: "/students", label: "Students", icon: BookOpen },
    { to: "/memberships", label: "Memberships", icon: ScrollText },
    { to: "/seat-map", label: "Seat Allocation", icon: Armchair },
    { to: "/seat-map-view", label: "Seat Overview", icon: Eye },
    { to: "/payments", label: "Payments", icon: Coins },
    { to: "/audit-logs", label: "Audit Logs", icon: Archive },
  ];

  return (
    <aside className="h-screen w-64 shrink-0 bg-[#7c2d12] text-amber-100 border-r border-[#5f1f0e] flex flex-col">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-[#5f1f0e]">
        <h1 className="text-lg font-semibold tracking-wide">
          Matoshree Study Lab
        </h1>
        <p className="text-xs text-amber-300 mt-1">Admin Console</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `
              flex items-center gap-3 px-3 py-2 rounded-md text-sm
              transition-colors duration-150
              ${
                isActive
                  ? "bg-[#f59e0b] text-[#3b1a0a] font-medium"
                  : "text-amber-100 hover:bg-[#92400e]/40"
              }
              `
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#5f1f0e]">
        <button
          onClick={() => {
            clearToken();
            navigate("/login");
            toast.info("Logged out successfully");
          }}
          className="flex items-center gap-3 px-3 py-2 text-sm text-amber-200 hover:bg-[#92400e]/40 rounded-md w-full transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
