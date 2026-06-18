import React from 'react';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'Instagram Clipper | Dashboard',
  description: 'Automated video clipping and publishing to Instagram',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main page content */}
      <main className="flex-1 md:pl-64 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10 pb-28 md:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
