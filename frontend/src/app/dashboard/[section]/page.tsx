import { notFound } from "next/navigation";
const sections = ["ujian", "bank-soal", "monitoring", "hasil", "guru"];
export default async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return null;
}
