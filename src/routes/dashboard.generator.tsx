import { useEffect, useState, type ComponentType } from 'react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/generator')({
  component: GeneratorPage,
  errorComponent: ({ error, reset }) => (
    <div className="bg-dark-900 border border-red-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
      <h2 className="text-xl font-black mb-2">The generator hit an error</h2>
      <p className="text-gray-400 text-sm mb-5">{error.message}</p>
      <button
        onClick={reset}
        className="bg-white text-dark-950 px-5 py-2.5 rounded-xl font-bold hover:bg-brand-400 hover:text-white transition"
      >
        Retry
      </button>
    </div>
  ),
});

function GeneratorPage() {
  const [LoadedApp, setLoadedApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    void import('@/App').then((module) => {
      if (!active) return;
      setLoadedApp(() => module.default);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dark-canvas min-h-dvh overflow-hidden bg-dark-950">
      {LoadedApp ? (
        <LoadedApp />
      ) : (
        <div className="flex min-h-dvh items-center justify-center text-gray-400">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Loading generator…
          </div>
        </div>
      )}
    </div>
  );
}