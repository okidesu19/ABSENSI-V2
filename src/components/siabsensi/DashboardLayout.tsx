'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  School,
  QrCode,
  ExternalLink
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kelas', label: 'Data Kelas', icon: Users },
  { id: 'siswa', label: 'Data Siswa', icon: UserCircle },
  { id: 'statistik', label: 'Statistik', icon: BarChart3 },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

export default function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { adminData, signOut } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <School className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-white">SIABSENSI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:bg-slate-800">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex-col z-50">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <School className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-lg">SIABSENSI</h1>
              <p className="text-xs text-slate-400">Face Recognition</p>
            </div>
          </div>
          
          <Button
            onClick={() => router.push('/?mode=absensi')}
            className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Halaman Absensi
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-6 py-3.5 text-left transition-all duration-200',
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-r-4 border-blue-400 shadow-lg shadow-blue-900/20'
                    : 'hover:bg-slate-800 hover:pl-8'
                )}
              >
                <Icon className={cn('w-5 h-5', activeTab === item.id ? 'text-blue-200' : 'text-slate-400')} />
                <span className={activeTab === item.id ? 'font-medium text-white' : 'text-slate-300'}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              {adminData?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{adminData?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{adminData?.email}</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800">
                <LogOut className="w-4 h-4 mr-2" />
                Keluar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin keluar dari aplikasi?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={signOut} className="bg-red-600 hover:bg-red-700">
                  Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'md:hidden fixed top-14 left-0 right-0 bg-slate-900 z-50 transition-transform duration-300',
          sidebarOpen ? 'translate-y-0' : '-translate-y-full'
        )}
      >
        <nav className="py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-6 py-3.5 text-white text-left transition-all duration-200',
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-900/20'
                    : 'hover:bg-slate-800'
                )}
              >
                <Icon className={cn('w-5 h-5', activeTab === item.id ? 'text-blue-200' : 'text-slate-400')} />
                <span className={activeTab === item.id ? 'font-medium' : ''}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800">
                <LogOut className="w-4 h-4 mr-2" />
                Keluar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin keluar dari aplikasi?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={signOut} className="bg-red-600 hover:bg-red-700">
                  Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 flex justify-around items-center z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 transition-colors',
                activeTab === item.id ? 'text-blue-400' : 'text-slate-400'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-6 pt-20 md:pt-6 pb-24 md:pb-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
