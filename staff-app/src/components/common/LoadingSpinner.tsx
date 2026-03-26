export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20' };
  return (
    <div className="flex justify-center items-center p-8">
      <img src="/loader_dark.gif" alt="Loading" className={sizes[size]} />
    </div>
  );
}
