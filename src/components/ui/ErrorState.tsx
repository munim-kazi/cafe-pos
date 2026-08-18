"use client";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-12 text-center">
      <h3 className="text-lg font-medium text-red-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-red-700">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
