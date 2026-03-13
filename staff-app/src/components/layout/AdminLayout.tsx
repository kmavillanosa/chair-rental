import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AdminLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role="admin" />
      <main className="min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
