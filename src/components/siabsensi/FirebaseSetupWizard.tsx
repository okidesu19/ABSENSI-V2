'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Database, Key, Globe, Shield, CheckCircle, 
  ArrowRight, Copy, ExternalLink, School 
} from 'lucide-react';
import { toast } from 'sonner';

const steps = [
  {
    id: 1,
    title: 'Buat Project Firebase',
    description: 'Buat project baru di Firebase Console',
    icon: Database,
    action: 'Buka Firebase Console',
    link: 'https://console.firebase.google.com'
  },
  {
    id: 2,
    title: 'Aktifkan Authentication',
    description: 'Aktifkan Email/Password authentication',
    icon: Shield,
    action: 'Lihat Panduan',
    link: 'https://firebase.google.com/docs/auth/web/start'
  },
  {
    id: 3,
    title: 'Aktifkan Realtime Database',
    description: 'Buat Realtime Database dengan mode locked',
    icon: Database,
    action: 'Lihat Panduan',
    link: 'https://firebase.google.com/docs/database/web/start'
  },
  {
    id: 4,
    title: 'Dapatkan Konfigurasi',
    description: 'Copy konfigurasi web app dari Project Settings',
    icon: Key,
    action: 'Buka Project Settings',
    link: 'https://console.firebase.google.com/project/_/settings/general'
  }
];

interface FirebaseSetupWizardProps {
  onConfigured?: () => void;
}

export default function FirebaseSetupWizard({ onConfigured }: FirebaseSetupWizardProps) {
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });

  const handleCopyEnv = () => {
    const envContent = `# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=${configForm.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${configForm.authDomain}
NEXT_PUBLIC_FIREBASE_DATABASE_URL=${configForm.databaseURL}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${configForm.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${configForm.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${configForm.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${configForm.appId}`;
    
    navigator.clipboard.writeText(envContent);
    toast.success('Konfigurasi disalin ke clipboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SIABSENSI</h1>
          <p className="text-blue-100 mt-2">Setup Firebase Configuration</p>
        </div>

        {/* Setup Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.id} className="bg-white/95">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Step {step.id}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-800">{step.title}</h3>
                      <p className="text-sm text-slate-500 mb-3">{step.description}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.open(step.link, '_blank')}
                      >
                        {step.action}
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Configuration Form */}
        <Card className="bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Konfigurasi Firebase
            </CardTitle>
            <CardDescription>
              Masukkan konfigurasi Firebase dari Project Settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  placeholder="AIzaSy..."
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authDomain">Auth Domain</Label>
                <Input
                  id="authDomain"
                  placeholder="your-project.firebaseapp.com"
                  value={configForm.authDomain}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, authDomain: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="databaseURL">Database URL</Label>
                <Input
                  id="databaseURL"
                  placeholder="https://your-project-default-rtdb.firebaseio.com"
                  value={configForm.databaseURL}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, databaseURL: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID</Label>
                <Input
                  id="projectId"
                  placeholder="your-project-id"
                  value={configForm.projectId}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, projectId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageBucket">Storage Bucket</Label>
                <Input
                  id="storageBucket"
                  placeholder="your-project.appspot.com"
                  value={configForm.storageBucket}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, storageBucket: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
                <Input
                  id="messagingSenderId"
                  placeholder="123456789012"
                  value={configForm.messagingSenderId}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, messagingSenderId: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="appId">App ID</Label>
                <Input
                  id="appId"
                  placeholder="1:123456789012:web:abcdef123456"
                  value={configForm.appId}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, appId: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">.env file content:</p>
                <Button variant="ghost" size="sm" onClick={handleCopyEnv}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
              <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap bg-slate-100 p-3 rounded">
{`# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=${configForm.apiKey || '...'}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${configForm.authDomain || '...'}
NEXT_PUBLIC_FIREBASE_DATABASE_URL=${configForm.databaseURL || '...'}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${configForm.projectId || '...'}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${configForm.storageBucket || '...'}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${configForm.messagingSenderId || '...'}
NEXT_PUBLIC_FIREBASE_APP_ID=${configForm.appId || '...'}`}
              </pre>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Langkah Selanjutnya:</h4>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Copy konfigurasi di atas</li>
                <li>Buat file <code className="bg-yellow-100 px-1">.env</code> di root project</li>
                <li>Paste konfigurasi ke dalam file .env</li>
                <li>Restart development server</li>
                <li>Buat admin user di Firebase Authentication</li>
                <li>Tambahkan data admin ke Realtime Database</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Database Rules */}
        <Card className="bg-white/95 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Database Rules
            </CardTitle>
            <CardDescription>
              Aturan keamanan untuk Realtime Database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">
              Salin aturan berikut ke Firebase Console → Realtime Database → Rules:
            </p>
            <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap bg-slate-100 p-3 rounded">
{`{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
    "attendance": {
      ".write": "auth != null || true"
    }
  }
}`}
            </pre>
          </CardContent>
        </Card>

        {/* Admin User Setup */}
        <Card className="bg-white/95 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Setup Admin User
            </CardTitle>
            <CardDescription>
              Tambahkan data admin ke database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">
              Setelah membuat user di Firebase Authentication, tambahkan data berikut ke Realtime Database:
            </p>
            <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap bg-slate-100 p-3 rounded">
{`// Path: /users/{user_uid}
{
  "email": "admin@sekolah.sch.id",
  "name": "Admin Sekolah",
  "role": "admin",
  "created_at": 1704067200000
}`}
            </pre>
          </CardContent>
        </Card>

        <p className="text-center text-white/80 text-sm mt-8">
          © 2024 SIABSENSI - Sistem Absensi Berbasis Face Recognition
        </p>
      </div>
    </div>
  );
}
