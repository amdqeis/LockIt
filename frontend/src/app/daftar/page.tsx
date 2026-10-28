import { redirect } from "next/navigation";

// Pendaftaran mandiri dinonaktifkan — redirect ke login
export default function DaftarPage() {
  redirect("/login");
}
