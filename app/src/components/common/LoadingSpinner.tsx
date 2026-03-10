export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-16 w-16' };
  return (
    <div className="flex justify-center items-center p-8">
      <div className={`${sizes[size]} animate-spin rounded-full border-4 border-blue-200 border-t-blue-600`} />
    </div>
  );
}
