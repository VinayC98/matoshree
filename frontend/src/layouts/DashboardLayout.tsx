import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export function DashboardLayout() {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-stone-50">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="min-h-full p-4 sm:p-5 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
