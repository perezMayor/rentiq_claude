import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseSession } from '@/src/lib/auth';
import { readStore } from '@/src/lib/store';

export default async function FullscreenLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('rq_v3_session')?.value;

  if (!token) redirect('/login');

  const session = parseSession(token);
  if (!session) redirect('/login');

  const store = readStore();
  const user = store.users.find((u) => u.id === session.userId);
  if (!user || !user.active) redirect('/login');

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: 'var(--color-bg-main)', color: 'var(--color-text-primary)', fontFamily: 'Poppins, sans-serif' }}>
      {children}
    </div>
  );
}
