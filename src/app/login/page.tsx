"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Mail, Lock, User, Loader2, Eye, EyeOff } from "lucide-react";
import s from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await signUp.email({
          name: name.trim() || "User",
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message || "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const res = await signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message || "Invalid credentials");
          setLoading(false);
          return;
        }
      }
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      {/* Abstract background */}
      <div className={s.bg}>
        <div className={`${s.orb} ${s.orb1}`} />
        <div className={`${s.orb} ${s.orb2}`} />
        <div className={`${s.orb} ${s.orb3}`} />
        <div className={`${s.orb} ${s.orb4}`} />
      </div>

      {/* Glass card */}
      <div className={s.card}>
        {/* Toggle tabs */}
        <div className={s.tabs}>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={`${s.tab} ${mode === "signup" ? s.tabActive : ""}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`${s.tab} ${mode === "login" ? s.tabActive : ""}`}
          >
            Sign in
          </button>
        </div>

        {/* Heading */}
        <h1 className={s.heading}>
          {mode === "signup" ? "Create an account" : "Welcome back"}
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className={s.form}>
          {mode === "signup" && (
            <div className={s.field}>
              <User size={16} className={s.fieldIcon} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className={s.input}
                autoComplete="name"
              />
            </div>
          )}

          <div className={s.field}>
            <Mail size={16} className={s.fieldIcon} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className={s.input}
              autoComplete="email"
            />
          </div>

          <div className={s.field}>
            <Lock size={16} className={s.fieldIcon} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
              className={`${s.input} ${s.inputPassword}`}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className={s.eye}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <div className={s.error}>{error}</div>}

          <button type="submit" disabled={loading} className={s.submit}>
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              mode === "signup" ? "Create an account" : "Sign in"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className={s.terms}>
          {mode === "signup"
            ? "By creating an account, you agree to our Terms & Service"
            : "Secure electronic signatures powered by PixSign"}
        </p>
      </div>
    </div>
  );
}
