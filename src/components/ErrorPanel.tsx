export interface UiError {
  title: string;
  hint: string;
  fileName?: string;
}

/** Errors always say what happened *and* what to do next. */
export function ErrorPanel({ error, onRetry }: { error: UiError; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-white p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl text-red-600">!</div>
        <div className="space-y-2">
          {error.fileName && <p className="text-sm text-gray-500">{error.fileName}</p>}
          <h2 className="text-lg font-semibold">{error.title}</h2>
          <p className="text-gray-600">{error.hint}</p>
          <button onClick={onRetry} className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Try another file
          </button>
        </div>
      </div>
    </div>
  );
}
