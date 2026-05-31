export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white">
          S<span className="text-accent">.</span>P
          <span className="text-accent">.</span>O
          <span className="text-accent">.</span>R
          <span className="text-accent">.</span>T
          <span className="text-accent">.</span>S
          <span className="text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Betstravaganza</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
