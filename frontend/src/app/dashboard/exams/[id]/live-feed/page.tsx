"use client";

import { useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

function LiveFeedRedirectContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/dashboard/exams/${id}/monitor`);
    }
  }, [id, router]);

  return (
    <div style={{ padding: 48, textAlign: "center", color: "#64748B", fontFamily: "var(--font-family)" }}>
      Mengalihkan ke pemantauan ujian...
    </div>
  );
}

export default function LiveFeedRedirect() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "#64748B" }}>Memuat...</div>}>
      <LiveFeedRedirectContent />
    </Suspense>
  );
}
