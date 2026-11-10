"use client";
import { MotionButton } from "@/components/MotionButton";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { staffSend, staffApi } from "@/lib/staff-api";
import { prefetchRouteAndData } from "@/lib/prefetch";
import type { Teacher } from "@/components/dashboard/types";
import "../dashboard/dashboard.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined" && document.cookie.includes("hasTeacherSession=1")) {
      staffApi<Teacher>("/api/auth/me")
        .then(() => {
          prefetchRouteAndData("/dashboard", router);
          router.replace("/dashboard");
        })
        .catch(() => {});
    }
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      await staffSend("/api/auth/login", "POST", { email, password, rememberMe });
      prefetchRouteAndData("/dashboard", router);
      router.replace("/dashboard");
    }
    catch (err) { setError(err instanceof Error ? err.message : "Gagal masuk."); }
    finally { setBusy(false); }
  }
  return <main className="staff-login"><motion.div className="staff-login-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32 }}>
    <Image src="/eduquas-logo.png" alt="EduQuas" width={126} height={32} className="staff-logo" />
    <h1>Selamat datang kembali</h1><p>Masuk untuk mengelola ujian dan memantau peserta.</p>
    <form onSubmit={submit} className="staff-form">
      <label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="staff-check">
        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
        <span>Ingat saya</span>
      </label>
      {error && <p className="staff-error" role="alert">{error}</p>}
      <MotionButton className="staff-primary" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</MotionButton>
    </form>
    <Link href="/">Kembali ke halaman peserta</Link>
  </motion.div></main>;
}
