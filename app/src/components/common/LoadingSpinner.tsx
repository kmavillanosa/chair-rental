export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20' };
  return (
    <div className="flex justify-center items-center p-8">
      <div
        role="status"
        aria-label="Loading"
        className={`${sizes[size]} animate-spin rounded-full border-4 border-slate-200 border-t-[#1f2944]`}
      />
    </div>
  );
}
