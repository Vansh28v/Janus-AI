
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { LockKeyhole, Mail, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Registration successful! Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080807] px-5 py-12 text-[#F1E8D8]">
      <div className="w-full max-w-md border border-[#C9A362]/20 bg-[#10100F] p-8 shadow-2xl sm:p-10">

        <div className="mb-9 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            JANUS<span className="text-[#E6C98E]"> AI</span>
            <span className="ml-2 text-xs tracking-[3px] text-[#8F826D]">AI</span>
          </h1>

          <p className="mt-3 text-[10px] tracking-[3px] text-[#A88B58]">
            POWER UTILITY INTELLIGENCE
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>

          <p className="mt-2 text-sm text-[#948875]">
            {isRegister
              ? "Register to access your intelligence workspace."
              : "Sign in to access your Janus AI workspace."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {isRegister && (
            <div>
              <label className="mb-2 block text-xs text-[#C9BDA8]">
                Full name
              </label>

              <div className="flex items-center border border-[#C9A362]/20 bg-[#080807] px-3">
                <User size={16} className="text-[#A88B58]" />
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent p-3 text-sm outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs text-[#C9BDA8]">
              Email address
            </label>

            <div className="flex items-center border border-[#C9A362]/20 bg-[#080807] px-3">
              <Mail size={16} className="text-[#A88B58]" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent p-3 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-[#C9BDA8]">
              Password
            </label>

            <div className="flex items-center border border-[#C9A362]/20 bg-[#080807] px-3">
              <LockKeyhole size={16} className="text-[#A88B58]" />
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-transparent p-3 text-sm outline-none"
              />
            </div>
          </div>

          {message && (
            <p className="border border-[#C9A362]/20 bg-[#C9A362]/5 p-3 text-xs leading-5 text-[#E6C98E]">
              {message}
            </p>
          )}

          <button
            disabled={loading}
            type="submit"
            className="flex w-full items-center justify-center gap-2 bg-[#C9A362] py-3.5 text-xs font-bold tracking-[2px] text-[#080807] transition hover:bg-[#E6C98E] disabled:opacity-50"
          >
            {loading
              ? "PLEASE WAIT..."
              : isRegister
                ? "CREATE ACCOUNT"
                : "SIGN IN"}

            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div className="mt-8 border-t border-[#C9A362]/15 pt-6 text-center">
          <p className="text-xs text-[#948875]">
            {isRegister
              ? "Already have an account?"
              : "Don't have an account?"}
          </p>

          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setMessage("");
            }}
            className="mt-2 text-xs font-semibold text-[#E6C98E] hover:text-white"
          >
            {isRegister ? "Sign in instead" : "Create an account"}
          </button>
        </div>

        <p className="mt-8 text-center text-[9px] tracking-wider text-[#716957]">
          JANUS AI · INTELLIGENCE WORKSPACE
        </p>
      </div>
    </main>
  );
}
