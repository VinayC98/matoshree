import { Navigate } from "react-router-dom";

type Props = {
  children: React.ReactNode;
};

export function PublicRoute({ children }: Props) {
  const token = localStorage.getItem("accessToken");

  // If already logged in → go to dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
