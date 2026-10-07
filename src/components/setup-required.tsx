type SetupRequiredProps = {
  problems: string[];
};

export function SetupRequired({ problems }: SetupRequiredProps) {
  const showDetails = process.env.NODE_ENV === "development";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-lg rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <h1 className="text-lg font-semibold">Setup required</h1>
        {showDetails ? (
          <>
            <p className="mt-2 text-sm">
              The app cannot connect to Supabase because its configuration is
              incomplete:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-sm">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              Copy <code className="font-mono">.env.example</code> to{" "}
              <code className="font-mono">.env.local</code>, fill in the values
              from your Supabase project (Project Settings → API), then restart
              the dev server.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm">
            This service is not configured yet. Please contact the
            administrator.
          </p>
        )}
      </div>
    </main>
  );
}
