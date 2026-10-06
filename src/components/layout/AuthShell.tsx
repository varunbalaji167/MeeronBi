/** Shared page shell for the standalone auth screens (forgot/set password, verify email, researcher access). */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
