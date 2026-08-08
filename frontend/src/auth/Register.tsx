import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { register } from "../api/auth.api";
import { setToken } from "../api/auth.store";
import { toast } from "react-toastify";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      setToken(data.accessToken);
      toast.success("Account created");
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast.error("Registration failed");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ name, email, password });
      }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-serif text-stone-800">
          Admin Registration
        </h2>
        <p className="text-sm text-stone-500">Create admin access</p>
      </div>

      <input
        className="w-full px-3 py-2 border border-[#e7d3b3] rounded"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <input
        className="w-full px-3 py-2 border border-[#e7d3b3] rounded"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        className="w-full px-3 py-2 border border-[#e7d3b3] rounded"
        placeholder="Password (min 6 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button
        disabled={mutation.isPending || password.length < 6}
        className="w-full bg-[#c2410c] hover:bg-[#9a3412] text-amber-100 py-2 rounded transition disabled:opacity-50"
      >
        {mutation.isPending ? "Creating..." : "Register"}
      </button>
    </form>
  );
}
