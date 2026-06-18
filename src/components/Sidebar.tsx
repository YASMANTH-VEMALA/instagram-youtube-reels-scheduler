'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PlusCircle, ListTodo, Radio, LogOut, Loader2, Film, Briefcase } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);

  const menuItems = [
    { name: 'Composer', href: '/', icon: PlusCircle },
    { name: 'Previewer', href: '/preview', icon: Film },
    { name: 'Queue', href: '/queue', icon: ListTodo },
    { name: 'Channels', href: '/channels', icon: Radio },
    { name: 'MonsterLab', href: '/monsterlab', icon: Briefcase },
  ];

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then((data) => setUser(data))
      .catch((err) => console.error('Failed to fetch user:', err));
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        router.refresh();
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="fixed bottom-0 left-0 z-40 w-full md:top-0 md:h-screen md:w-64 bg-sidebar border-t-2 md:border-t-0 md:border-r-2 border-sidebar-border px-4 py-3 md:py-6 flex md:flex-col justify-between items-center md:items-stretch overflow-y-auto">
      <div className="flex flex-col w-full">
        {/* Brand logo */}
        <div className="hidden md:flex items-center gap-3 px-2 mb-8">
          <div className="w-8 h-8 bg-primary border-2 border-border flex items-center justify-center font-black text-primary-foreground shadow-[2px_2px_0px_0px_var(--shadow-color)]">
            IG
          </div>
          <span className="font-extrabold text-xl text-sidebar-foreground tracking-wider uppercase">
            Clipper
          </span>
        </div>

        {/* Nav Menu */}
        <nav className="flex md:flex-col gap-2.5 w-full md:w-auto justify-around md:justify-start">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-2 border-border shadow-[3px_3px_0px_0px_var(--shadow-color)] translate-x-[-1px] translate-y-[-1px]'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/10 border-2 border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-primary-foreground' : 'text-sidebar-foreground'} />
                <span className="hidden sm:inline md:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profile & Logout Section */}
      <div className="flex flex-col w-full md:mt-auto">
        {/* User profile card */}
        {user && (
          <div className="hidden md:block mb-4 p-3 bg-white border-2 border-border rounded-none shadow-[2px_2px_0px_0px_var(--shadow-color)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-none bg-primary text-primary-foreground font-black text-xs flex items-center justify-center border-2 border-border uppercase flex-shrink-0">
                {user.username.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-foreground truncate uppercase tracking-wider">{user.username}</p>
                <p className="text-[10px] text-zinc-500 font-bold truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10 border-2 border-transparent hover:border-border hover:shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer disabled:opacity-50 w-full"
        >
          {loggingOut ? (
            <Loader2 size={18} className="animate-spin text-destructive" />
          ) : (
            <LogOut size={18} />
          )}
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
