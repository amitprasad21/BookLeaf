import type { Metadata } from "next";
import { Suspense } from "react";
import { QueueScreen } from "@/features/queue/QueueScreen";

export const metadata: Metadata = { title: "Queue" };

export default function QueuePage() {
  // Filters live in the query string (useSearchParams needs Suspense).
  return (
    <Suspense fallback={null}>
      <QueueScreen />
    </Suspense>
  );
}
