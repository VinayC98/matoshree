import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "../auth/Login";
import Register from "../auth/Register";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PubliRoute";
import Students from "../students/Students";
import Dashboard from "../dashboard/Dashboard";
import Memberships from "../membership/memberships";
import SeatMap from "../seat-map/SeatMap";
import Payments from "../payments/Payments";
import AuditLogs from "../audit/AuditLogs";
import SeatMapView from "../seat-map/SeatMapView";
import StudentDetails from "../students/StudentDetails";
import ErrorPage from "../layouts/ErrorPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/register",
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
        errorElement: <ErrorPage />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
        errorElement: <ErrorPage />,
      },
      {
        path: "students",
        element: <Students />,
        errorElement: <ErrorPage />,
      },
      {
        path: "memberships",
        element: <Memberships />,
        errorElement: <ErrorPage />,
      },
      {
        path: "seat-map",
        element: <SeatMap />,
        errorElement: <ErrorPage />,
      },
      {
        path: "payments",
        element: <Payments />,
        errorElement: <ErrorPage />,
      },
      {
        path: "audit-logs",
        element: <AuditLogs />,
        errorElement: <ErrorPage />,
      },
      {
        path: "seat-map-view",
        element: <SeatMapView />,
        errorElement: <ErrorPage />,
      },
      {
        path: "students/:id",
        element: <StudentDetails />,
        errorElement: <ErrorPage />,
      },
    ],
  },
]);
