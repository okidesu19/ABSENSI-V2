'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/siabsensi/LoginPage';
import DashboardLayout from '@/components/siabsensi/DashboardLayout';
import DashboardTab from '@/components/siabsensi/DashboardTab';
import KelasTab from '@/components/siabsensi/KelasTab';
import SiswaTab from '@/components/siabsensi/SiswaTab';
import StatistikTab from '@/components/siabsensi/StatistikTab';
import PengaturanTab from '@/components/siabsensi/PengaturanTab';
import StudentForm from '@/components/siabsensi/StudentForm';
import AbsensiPage from '@/components/siabsensi/AbsensiPage';
import FirebaseSetupWizard from '@/components/siabsensi/FirebaseSetupWizard';
import CardTemplateEditor from '@/components/siabsensi/CardTemplateEditor';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading, firebaseError } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');

  const isAddStudent = searchParams.get('add') === 'student';
  const editStudentId = searchParams.get('edit');
  const isAbsensiMode = searchParams.get('mode') === 'absensi';
  const isCardTemplate = searchParams.get('template') === 'card';

  // Check if we're in absensi (public) mode
  if (isAbsensiMode) {
    return <AbsensiPage />;
  }

  // Check if we're in card template editor mode
  if (isCardTemplate) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (!user) {
      return <LoginPage />;
    }

    return <CardTemplateEditor />;
  }

  // Show Firebase setup wizard if there's a configuration error
  if (firebaseError) {
    return <FirebaseSetupWizard />;
  }

  // Check if we're in add/edit student mode
  if (isAddStudent || editStudentId) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (!user) {
      return <LoginPage />;
    }

    return <StudentForm />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <LoginPage />;
  }

  // Render dashboard with active tab
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'kelas':
        return <KelasTab />;
      case 'siswa':
        return <SiswaTab />;
      case 'statistik':
        return <StatistikTab />;
      case 'pengaturan':
        return <PengaturanTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderActiveTab()}
    </DashboardLayout>
  );
}
