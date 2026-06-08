import App from '@/App';
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
  return (
    <div className="dark-canvas min-h-dvh overflow-hidden bg-dark-950">
      <App />
    </div>
  );
}