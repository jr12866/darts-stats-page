import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p
            className="clover text-4xl leading-none"
            aria-hidden="true"
          >
            ☘
          </p>
          <h1 className="brass-text mt-3 text-3xl font-bold tracking-wide">
            DartLeague
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pull up a stool and sign in.
          </p>
        </div>

        <div className="wood-grain rounded-lg border border-border-strong bg-surface p-6 shadow-xl shadow-black/50">
          <Suspense
            fallback={
              <p className="text-sm text-muted">Checking the door…</p>
            }
          >
            <AlreadySignedIn />
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Players don&rsquo;t need accounts — only admins and scorers do.
        </p>
      </div>
    </main>
  );
}

async function AlreadySignedIn() {
  const user = await getSessionUser();
  if (user) redirect("/leagues");
  return null;
}
