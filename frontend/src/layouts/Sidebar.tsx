import { NavLink, useNavigate } from "react-router-dom";
import {
  Archive,
  Armchair,
  BookOpen,
  Castle,
  Coins,
  Eye,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { clearToken } from "../api/auth.store";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Castle;
};

const navItems: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: Castle,
  },
  {
    to: "/students",
    label: "Students",
    icon: BookOpen,
  },
  {
    to: "/memberships",
    label: "Memberships",
    icon: ScrollText,
  },
  {
    to: "/seat-map",
    label: "Seat Allocation",
    icon: Armchair,
  },
  {
    to: "/seat-map-view",
    label: "Seat Overview",
    icon: Eye,
  },
  {
    to: "/payments",
    label: "Payments",
    icon: Coins,
  },
  {
    to: "/audit-logs",
    label: "Audit Logs",
    icon: Archive,
  },
];

const STORAGE_KEY = "matoshree-admin-sidebar-collapsed";

export default function Sidebar() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  /*
   * Persist desktop sidebar state.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage may be unavailable in restricted/private contexts.
    }
  }, [collapsed]);

  /*
   * Mobile drawer:
   * - Escape closes it.
   * - Prevent background page scrolling while open.
   * - Always restore the previous body overflow value.
   */
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      clearToken();

      toast.info("Logged out successfully");

      navigate("/login", {
        replace: true,
      });
    } catch {
      /*
       * Do not leave the button disabled if an unexpected
       * navigation/storage error occurs.
       */
      setLoggingOut(false);
    }
  };

  const handleNavigationClick = () => {
    /*
     * Only matters on mobile.
     * Desktop sidebar remains open because mobileOpen is false.
     */
    setMobileOpen(false);
  };

  return (
    <>
      {/* =====================================================
          MOBILE TOP BAR
      ===================================================== */}
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-stone-200 bg-white/95 px-3 shadow-sm backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100 active:scale-95"
        >
          <Menu size={20} />
        </button>

        <div className="ml-3 min-w-0">
          <div className="truncate text-sm font-semibold text-stone-800">
            Matoshree Study Lab
          </div>

          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
            Admin Console
          </div>
        </div>
      </header>

      {/* =====================================================
          MOBILE BACKDROP
      ===================================================== */}
      <div
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
        className={[
          "fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-[1px]",
          "transition-opacity duration-200 lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <aside
        aria-label="Main navigation"
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden",
          "border-r border-[#5f1f0e] bg-[#4b1609] text-amber-50 shadow-2xl",
          "transition-[width,transform] duration-300 ease-out",
          "lg:relative lg:z-auto lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
          "w-[280px]",
        ].join(" ")}
      >
        {/* =================================================
            BRAND / CONTROLS
        ================================================= */}
        <div
          className={[
            "flex h-16 shrink-0 items-center border-b border-[#5f1f0e]",
            collapsed ? "justify-center px-2" : "gap-3 px-4",
          ].join(" ")}
        >
          {/* Brand icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-[#3b1a0a] shadow-sm">
            <Castle size={19} strokeWidth={2.2} />
          </div>

          {/* Brand text */}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-amber-50">
                Matoshree Study Lab
              </div>

              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-200/70">
                Admin Console
              </div>
            </div>
          )}

          {/* =================================================
              DESKTOP COLLAPSE
          ================================================= */}
          <button
            type="button"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className={[
              "hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              "text-amber-100/70 transition",
              "hover:bg-[#92400e]/40 hover:text-amber-50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
              "lg:inline-flex",
            ].join(" ")}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>

          {/* =================================================
              MOBILE CLOSE
          ================================================= */}
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-100/70 transition hover:bg-[#92400e]/40 hover:text-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}
        <nav
          aria-label="Primary navigation"
          className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4"
        >
          <div className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/dashboard"}
                title={collapsed ? label : undefined}
                onClick={handleNavigationClick}
                className={({ isActive }) =>
                  [
                    "group relative flex min-h-10 items-center rounded-lg",
                    "transition-[background-color,color,transform] duration-150",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    isActive
                      ? "bg-amber-500 text-[#3b1a0a] shadow-sm"
                      : "text-amber-100/85 hover:bg-[#92400e]/45 hover:text-amber-50",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active rail */}
                    <span
                      aria-hidden="true"
                      className={[
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full",
                        "transition-opacity duration-150",
                        isActive ? "bg-[#3b1a0a] opacity-100" : "opacity-0",
                      ].join(" ")}
                    />

                    {/* Icon */}
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2.3 : 2}
                      className="shrink-0"
                    />

                    {/* Label */}
                    {!collapsed && (
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                    )}

                    {/* Collapsed tooltip */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
                        {label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* =================================================
            FOOTER / LOGOUT
        ================================================= */}
        <div
          className={[
            "shrink-0 border-t border-[#5f1f0e] p-2.5",
            collapsed ? "flex justify-center" : "",
          ].join(" ")}
        >
          <button
            type="button"
            title={collapsed ? "Logout" : undefined}
            disabled={loggingOut}
            onClick={handleLogout}
            className={[
              "group relative flex min-h-10 w-full items-center rounded-lg",
              "text-sm text-amber-200 transition",
              "hover:bg-[#92400e]/40 hover:text-amber-50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
              "disabled:cursor-not-allowed disabled:opacity-60",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
            ].join(" ")}
          >
            <LogOut size={18} className="shrink-0" />

            {!collapsed && (
              <span className="font-medium">
                {loggingOut ? "Logging out..." : "Logout"}
              </span>
            )}

            {collapsed && (
              <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
