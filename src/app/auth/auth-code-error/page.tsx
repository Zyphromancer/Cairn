import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-xl">
        That link didn&apos;t work
      </h1>
      <p className="max-w-sm text-text-muted">
        It may have expired, or already been used. Request a new one.
      </p>
      <Link
        href="/login"
        className="rounded-[var(--radius-cairn)] border border-border px-4 py-2 text-sm hover:bg-surface"
      >
        Back to login
      </Link>
    </main>
  );
}
