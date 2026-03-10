import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AdminLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="admin" />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
