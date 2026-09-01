import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { AdminAction } from '../AdminAction';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/admin/login');

  return (
    <>
      <header className="bg-stone-900 text-white dark:bg-black">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <span className="font-display font-bold">🐺 ADMIN</span>
          <nav className="flex gap-3 text-sm text-stone-300">
            <Link href="/admin" className="hover:text-white">
              Dashboard
            </Link>
            <Link href="/admin/users" className="hover:text-white">
              Users
            </Link>
            <Link href="/admin/reports" className="hover:text-white">
              Reports
            </Link>
            <Link href="/" className="hover:text-white">
              ← Site
            </Link>
          </nav>
          <span className="ml-auto">
            <AdminAction label="Logout" url="/api/admin/logout" redirectTo="/" />
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
