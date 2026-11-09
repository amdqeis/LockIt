"use client";
import { MotionButton } from "@/components/MotionButton";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { staffSend } from "@/lib/staff-api";
import "../dashboard/dashboard.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await staffSend("/api/auth/login", "POST", { email, password }); router.replace("/dashboard"); }
    catch (err) { setError(err instanceof Error ? err.message : "Gagal masuk."); }
    finally { setBusy(false); }
  }
  return <main className="staff-login"><motion.div className="staff-login-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32 }}>
    <Image src="/eduquas-logo.png" alt="EduQuas" width={126} height={32} className="staff-logo" />
    <h1>Selamat datang kembali</h1><p>Masuk untuk mengelola ujian dan memantau peserta.</p>
    <form onSubmit={submit} className="staff-form"><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="staff-error" role="alert">{error}</p>}<MotionButton className="staff-primary" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</MotionButton></form>
    <Link href="/">Kembali ke halaman peserta</Link>
  </motion.div></main>;
}
