import Sidebar from './Sidebar';

export default function VendorLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="vendor" />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
