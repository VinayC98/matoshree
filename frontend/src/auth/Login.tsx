import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";

import { login } from "../api/auth.api";
import { setToken } from "../api/auth.store";
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
      toast.success("Welcome back");
      window.location.href = "/dashboard";
    },

    onError: () => {
      toast.error("Invalid email or password");
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid || mutation.isPending) {
      return;
    }

    mutation.mutate({
      email: email.trim(),
      password,
    });
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
            <ShieldCheck size={27} strokeWidth={1.8} />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
            Admin Console
          </h1>

          <p className="mt-1.5 text-sm text-stone-500">
            Sign in to manage Matoshree Study Lab
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="on"
          noValidate
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-3">
            <LockKeyhole
              size={16}
              strokeWidth={1.8}
              className="shrink-0 text-amber-700"
            />

            <p className="text-xs leading-5 text-stone-600">
              Authorized administrators only.
            </p>
          </div>

          <div className="space-y-5">
            {/* Email */}

            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={email.length > 0 && !isEmailValid}
                  aria-describedby={
                    email.length > 0 && !isEmailValid
                      ? "login-email-error"
                      : undefined
                  }
                  className={[
                    "h-11 w-full rounded-xl border bg-stone-50 pl-10 pr-3",
                    "text-sm text-stone-800 outline-none",
                    "placeholder:text-stone-400",
                    "transition-colors duration-150",
                    "focus:bg-white focus:ring-2",
                    email.length > 0 && !isEmailValid
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-100",
                  ].join(" ")}
                />
              </div>

              <div className="min-h-[20px]">
                {email.length > 0 && !isEmailValid && (
                  <p
                    id="login-email-error"
                    className="mt-1.5 text-[11px] text-red-600"
                  >
                    Enter a valid email address.
                  </p>
                )}
              </div>
            </div>

            {/* Password */}

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />

                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={password.length > 0 && !isPasswordValid}
                  aria-describedby={
                    password.length > 0 && !isPasswordValid
                      ? "login-password-error"
                      : undefined
                  }
                  className={[
                    "h-11 w-full rounded-xl border bg-stone-50 pl-10 pr-11",
                    "text-sm text-stone-800 outline-none",
                    "placeholder:text-stone-400",
                    "transition-colors duration-150",
                    "focus:bg-white focus:ring-2",
                    password.length > 0 && !isPasswordValid
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-100",
                  ].join(" ")}
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="min-h-[20px]">
                {password.length > 0 && !isPasswordValid && (
                  <p
                    id="login-password-error"
                    className="mt-1.5 text-[11px] text-red-600"
                  >
                    Password must be at least 6 characters.
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}

            <button
              type="submit"
              disabled={!isFormValid || mutation.isPending}
              className={[
                "flex h-11 w-full items-center justify-center rounded-xl",
                "text-sm font-semibold",
                "transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-1",
                mutation.isPending || !isFormValid
                  ? "cursor-not-allowed bg-stone-200 text-stone-400"
                  : "bg-amber-600 text-white shadow-sm hover:bg-amber-700 hover:shadow-md active:translate-y-px",
              ].join(" ")}
            >
              {mutation.isPending ? (
                <>
                  <span
                    className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          {/* Register link */}

          <div className="mt-6 border-t border-stone-100 pt-5 text-center">
            <p className="text-xs text-stone-500">
              Need an admin account?{" "}
              <Link
                to="/register"
                className="font-semibold text-amber-700 transition-colors hover:text-amber-800 hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>
        </form>

        <p className="mt-5 text-center text-[11px] text-stone-400">
          Matoshree Study Lab · Admin Console
        </p>
      </div>
    </AuthLayout>
  );
}
