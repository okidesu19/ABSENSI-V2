'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, update, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { 
  User, Clock, Bell, Database, Trash2, Save, 
  RefreshCw, Shield, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Settings {
  jam_masuk: string;
  jam_terlambat: string;
  hari_aktif: string[];
  notifications_enabled: boolean;
}

const defaultSettings: Settings = {
  jam_masuk: '07:00',
  jam_terlambat: '07:30',
  hari_aktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
  notifications_enabled: false
};

const hariOptions = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function PengaturanTab() {
  const { adminData, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    newPassword: ''
  });
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings({ ...defaultSettings, ...snapshot.val() });
      }
      setLoading(false);
    });

    // Set profile form
    if (adminData) {
      setProfileForm(prev => ({
        ...prev,
        name: adminData.name || '',
        email: adminData.email || ''
      }));
    }

    return () => unsubscribe();
  }, [adminData]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Update name in database
      await update(ref(database, `users/${user.uid}`), {
        name: profileForm.name
      });

      // Update password if provided
      if (profileForm.newPassword && profileForm.newPassword.length >= 6) {
        await updatePassword(user, profileForm.newPassword);
      }

      toast.success('Profil berhasil diperbarui');
      setProfileForm(prev => ({ ...prev, newPassword: '' }));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await update(ref(database, 'settings'), settings);
      toast.success('Pengaturan berhasil disimpan');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleHariAktifChange = (hari: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      hari_aktif: checked
        ? [...prev.hari_aktif, hari]
        : prev.hari_aktif.filter(h => h !== hari)
    }));
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Izin notifikasi ditolak');
        return;
      }
    }
    setSettings(prev => ({ ...prev, notifications_enabled: enabled }));
  };

  const handleBackup = async () => {
    try {
      const snapshot = await get(ref(database, '/'));
      const data = snapshot.val();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-siabsensi-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh');
    } catch (error) {
      console.error('Error backing up:', error);
      toast.error('Terjadi kesalahan saat backup');
    }
  };

  const handleResetDatabase = async () => {
    if (confirmDelete !== 'HAPUS SEMUA DATA') {
      toast.error('Konfirmasi tidak sesuai');
      return;
    }

    try {
      // This would typically require admin SDK on server side
      // For demo purposes, we'll just show a message
      toast.error('Fitur reset database memerlukan akses admin server');
      setConfirmDelete('');
    } catch (error) {
      console.error('Error resetting database:', error);
      toast.error('Terjadi kesalahan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-slate-500 mt-1">Kelola pengaturan aplikasi</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Profil Admin</CardTitle>
          </div>
          <CardDescription>Kelola informasi profil dan password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profileForm.email}
                disabled
                className="bg-slate-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Password Baru</Label>
            <Input
              id="newPassword"
              type="password"
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Kosongkan jika tidak ingin mengubah"
            />
            <p className="text-xs text-slate-500">Minimal 6 karakter</p>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Simpan Perubahan
          </Button>
        </CardContent>
      </Card>

      {/* Time Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Konfigurasi Waktu Absensi</CardTitle>
          </div>
          <CardDescription>Atur waktu masuk dan batas terlambat</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jamMasuk">Jam Masuk</Label>
              <Input
                id="jamMasuk"
                type="time"
                value={settings.jam_masuk}
                onChange={(e) => setSettings(prev => ({ ...prev, jam_masuk: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jamTerlambat">Jam Terlambat</Label>
              <Input
                id="jamTerlambat"
                type="time"
                value={settings.jam_terlambat}
                onChange={(e) => setSettings(prev => ({ ...prev, jam_terlambat: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Hari Aktif</Label>
            <div className="flex flex-wrap gap-4">
              {hariOptions.map(hari => (
                <div key={hari} className="flex items-center space-x-2">
                  <Checkbox
                    id={`hari-${hari}`}
                    checked={settings.hari_aktif.includes(hari)}
                    onCheckedChange={(checked) => handleHariAktifChange(hari, checked as boolean)}
                  />
                  <Label htmlFor={`hari-${hari}`} className="cursor-pointer font-normal">
                    {hari}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Simpan Pengaturan
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-600" />
            <CardTitle className="text-lg">Notifikasi</CardTitle>
          </div>
          <CardDescription>Kelola preferensi notifikasi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Aktifkan Notifikasi Browser</p>
              <p className="text-sm text-slate-500">Terima pemberitahuan untuk absensi baru</p>
            </div>
            <Switch
              checked={settings.notifications_enabled}
              onCheckedChange={handleNotificationToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">Backup & Restore</CardTitle>
          </div>
          <CardDescription>Backup data sistem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBackup} variant="outline" className="gap-2">
              <Database className="w-4 h-4" />
              Export Database (JSON)
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Export akan mengunduh semua data dalam format JSON
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <CardTitle className="text-lg text-red-700">Zona Berbahaya</CardTitle>
          </div>
          <CardDescription className="text-red-600">
            Tindakan di bawah ini tidak dapat dibatalkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Reset Seluruh Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  Konfirmasi Reset Database
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini akan menghapus SELURUH data termasuk siswa, kelas, dan absensi.
                  Ketik <strong className="text-red-600">HAPUS SEMUA DATA</strong> untuk konfirmasi:
                  <Input
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    placeholder="Ketik konfirmasi..."
                    className="mt-3"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmDelete('')}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetDatabase}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={confirmDelete !== 'HAPUS SEMUA DATA'}
                >
                  Hapus Semua Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
