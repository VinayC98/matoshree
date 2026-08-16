import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "react-toastify";

import { register } from "../api/auth.api";
import { setToken } from "../api/auth.store";
import AuthLayout from "../layouts/AuthLayout";
import { emailRegex, isValidPassword } from "../utils/validators";

type RegisterErrorResponse = {
  message?: string | string[];
};

type RegisterError = {
  response?: {
    data?: RegisterErrorResponse;
  };
  message?: string;
};

function getRegistrationErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const registerError = error as RegisterError;

    const responseMessage = registerError.response?.data?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(", ");
    }

    if (
      typeof responseMessage === "string" &&
      responseMessage.trim().length > 0
    ) {
      return responseMessage;
    }

    if (
      typeof registerError.message === "string" &&
      registerError.message.trim().length > 0
    ) {
      return registerError.message;
    }
  }

  return "Registration failed. Please check your details and try again.";
}

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationCode, setRegistrationCode] = useState("");
  const [showRegistrationCode, setShowRegistrationCode] = useState(false);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedRegistrationCode = registrationCode.trim();

  const isNameValid = trimmedName.length >= 2;
  const isEmailValid = emailRegex.test(trimmedEmail);
  const isPasswordValid = isValidPassword(password);
  const isRegistrationCodeValid = trimmedRegistrationCode.length > 0;

  const isFormValid =
    isNameValid && isEmailValid && isPasswordValid && isRegistrationCodeValid;

  const mutation = useMutation({
    mutationFn: register,

    onSuccess: (data) => {
      /*
       * Only successful registration reaches this block.
       * Token storage and dashboard redirect therefore happen
       * only after the backend confirms account creation.
       */
      setToken(data.accessToken);

      toast.success("Account created");

      window.location.href = "/dashboard";
    },

    onError: (error: unknown) => {
      /*
       * Do not set a token.
       * Do not navigate.
       * Keep the user on the registration page.
       */
      const message = getRegistrationErrorMessage(error);

      toast.error(message);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid || mutation.isPending) {
      return;
    }

    mutation.mutate({
      name: trimmedName,
      email: trimmedEmail,
      password,
      registrationCode: trimmedRegistrationCode,
    });
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        {/* Header */}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
            <ShieldCheck size={27} strokeWidth={1.8} />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
            Create Admin Account
          </h1>

          <p className="mt-1.5 text-sm text-stone-500">
            Set up administrator access for Matoshree Study Lab
          </p>
        </div>

        {/* Registration Card */}

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
              Create an account only for an authorized administrator.
            </p>
          </div>

          <div className="space-y-5">
            {/* Name */}

            <div>
              <label
                htmlFor="register-name"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Full name
              </label>

              <div className="relative">
                <UserRound
                  size={17}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />

                <input
                  id="register-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Administrator name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={name.length > 0 && !isNameValid}
                  aria-describedby={
                    name.length > 0 && !isNameValid
                      ? "register-name-error"
                      : undefined
                  }
                  className={[
                    "h-11 w-full rounded-xl border bg-stone-50 pl-10 pr-3",
                    "text-sm text-stone-800 outline-none",
                    "placeholder:text-stone-400",
                    "transition-colors duration-150",
                    "focus:bg-white focus:ring-2",
                    name.length > 0 && !isNameValid
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-100",
                  ].join(" ")}
                />
              </div>

              <div className="min-h-[20px]">
                {name.length > 0 && !isNameValid && (
                  <p
                    id="register-name-error"
                    className="mt-1.5 text-[11px] text-red-600"
                  >
                    Name must be at least 2 characters.
                  </p>
                )}
              </div>
            </div>

            {/* Email */}

            <div>
              <label
                htmlFor="register-email"
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
                  id="register-email"
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
                      ? "register-email-error"
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
                    id="register-email-error"
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
                htmlFor="register-password"
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
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={password.length > 0 && !isPasswordValid}
                  aria-describedby={
                    password.length > 0 && !isPasswordValid
                      ? "register-password-error"
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
                    id="register-password-error"
                    className="mt-1.5 text-[11px] text-red-600"
                  >
                    Password must be at least 6 characters.
                  </p>
                )}
              </div>
            </div>

            {/* Admin Registration Code */}

            <div>
              <label
                htmlFor="registration-code"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Admin registration code
              </label>

              <div className="relative">
                <input
                  id="registration-code"
                  name="registrationCode"
                  type={showRegistrationCode ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Enter your admin code"
                  value={registrationCode}
                  onChange={(event) => setRegistrationCode(event.target.value)}
                  aria-invalid={
                    registrationCode.length > 0 && !isRegistrationCodeValid
                  }
                  className={[
                    "h-11 w-full rounded-xl border bg-stone-50 px-3 pr-11",
                    "text-sm text-stone-800 outline-none",
                    "placeholder:text-stone-400",
                    "transition-colors duration-150",
                    "focus:bg-white focus:ring-2",
                    "border-stone-200 focus:border-amber-500 focus:ring-amber-100",
                  ].join(" ")}
                />

                <button
                  type="button"
                  aria-label={
                    showRegistrationCode
                      ? "Hide registration code"
                      : "Show registration code"
                  }
                  aria-pressed={showRegistrationCode}
                  onClick={() => setShowRegistrationCode((current) => !current)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  {showRegistrationCode ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-[11px] text-stone-400">
                This code is provided only to authorized administrators.
              </p>
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
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>

            {/* Server error */}

            {mutation.isError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700"
              >
                {getRegistrationErrorMessage(mutation.error)}
              </div>
            )}
          </div>

          {/* Login link */}

          <div className="mt-6 border-t border-stone-100 pt-5 text-center">
            <p className="text-xs text-stone-500">
              Already have an admin account?{" "}
              <Link
                to="/login"
                className="font-semibold text-amber-700 transition-colors hover:text-amber-800 hover:underline"
              >
                Sign in
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
