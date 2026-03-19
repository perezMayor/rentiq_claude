import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseSession } from '@/src/lib/auth';
import { readStore } from '@/src/lib/store';
import AppShell from './AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('rq_v3_session')?.value;

  if (!token) {
    redirect('/login');
  }

  const session = parseSession(token);
  if (!session) {
    redirect('/login');
  }

  const store = readStore();
  const user = store.users.find((u) => u.id === session.userId);
  if (!user || !user.active) {
    redirect('/login');
  }

  const branch = store.branches.find((b) => b.id === store.settings.defaultBranchId);

  return (
    <AppShell
      user={{ id: user.id, name: user.name, role: user.role, email: user.email }}
      branch={branch ? { id: branch.id, name: branch.name } : null}
    >
      {children}
    </AppShell>
  );
}
