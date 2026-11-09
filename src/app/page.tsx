import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}

async function Redirector(): Promise<never> {
  const user = await getSessionUser();
  redirect(user ? "/leagues" : "/login");
}
