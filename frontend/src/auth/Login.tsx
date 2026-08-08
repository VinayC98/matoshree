import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login } from "../api/auth.api";
import { setToken } from "../api/auth.store";
import { toast } from "react-toastify";
import AuthLayout from "../layouts/AuthLayout";
import { emailRegex, isValidPassword } from "../utils/validators";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isEmailValid = emailRegex.test(email);
  const isPasswordValid = isValidPassword(password);
  const isFormValid = isEmailValid && isPasswordValid;

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.accessToken);
      toast.success("Welcome back 👋");
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast.error("Invalid email or password");
    },
  });

  return (
    <AuthLayout>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isFormValid) return;
          mutation.mutate({ email, password });
        }}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md space-y-5 "
      >
        <h2 className="text-2xl font-semibold text-center">Admin Login</h2>

        {/* Email */}
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            className={`w-full mt-1 border p-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-700 ${
              email && !isEmailValid ? "border-red-500" : ""
            }`}
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email && !isEmailValid && (
            <p className="text-xs text-red-500 mt-1">
              Enter a valid email address
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="text-sm font-medium">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full mt-1 border p-2 rounded pr-10 focus:outline-none focus:ring-2 focus:ring-orange-700"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {password && !isPasswordValid && (
            <p className="text-xs text-red-500 mt-1">
              Password must be at least 6 characters
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          disabled={!isFormValid || mutation.isPending}
          className="w-full bg-blue-800 text-white py-2 rounded disabled:opacity-50 transition"
        >
          {mutation.isPending ? "Logging in..." : "Login"}
        </button>
      </form>
    </AuthLayout>
  );
}
