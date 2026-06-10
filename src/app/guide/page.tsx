export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">MessMate Guide</h1>
          <p className="text-slate-300">
            This guide explains the role-based demo flow for students, mess staff, and wardens.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-medium">Student Flow</h2>
          <ol className="list-decimal pl-5 space-y-1 text-slate-300">
            <li>Open the sign-in page and choose Student role.</li>
            <li>Use demo credentials or your own account.</li>
            <li>Submit meal opt-ins, vote, rate meals, and claim leftovers.</li>
          </ol>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-medium">Mess Staff Flow</h2>
          <ol className="list-decimal pl-5 space-y-1 text-slate-300">
            <li>Sign in as Staff from the role selector.</li>
            <li>Track live opt-ins and cooking tasks.</li>
            <li>Log daily waste and monitor meal execution.</li>
          </ol>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-medium">Warden Flow</h2>
          <ol className="list-decimal pl-5 space-y-1 text-slate-300">
            <li>Sign in as Warden from the same login screen.</li>
            <li>Review KPIs for waste, ratings, and attendance.</li>
            <li>Use analytics trends to improve mess planning.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
