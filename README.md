# 🚀 Aplikasi Absensi Digital

Aplikasi web absensi modern untuk pengelolaan kehadiran siswa dan data akademik.

## ✨ Technology Stack

Aplikasi ini dibangun dengan teknologi modern:

### 🎯 Core Framework

- **⚡ Next.js 16** - The React framework for production with App Router
- **📘 TypeScript 5** - Type-safe JavaScript for better developer experience
- **🎨 Tailwind CSS 4** - Utility-first CSS framework for rapid UI development

### 🧩 UI Components & Styling

- **🧩 shadcn/ui** - High-quality, accessible components built on Radix UI
- **🎯 Lucide React** - Beautiful & consistent icon library
- **🌈 Framer Motion** - Production-ready motion library for React
- **🎨 Next Themes** - Perfect dark mode in 2 lines of code

### 📋 Forms & Validation

- **🎣 React Hook Form** - Performant forms with easy validation
- **✅ Zod** - TypeScript-first schema validation

### 🔄 State Management & Data Fetching

- **🐻 Zustand** - Simple, scalable state management
- **🔄 TanStack Query** - Powerful data synchronization for React
- **🌐 Fetch** - Promise-based HTTP request

### 🗄️ Database & Backend

- **🗄️ Prisma** - Next-generation TypeScript ORM
- **🔐 Firebase** - Backend services for authentication and realtime database

### 🎨 Advanced UI Features

- **📊 TanStack Table** - Headless UI for building tables and datagrids
- **🖱️ DND Kit** - Modern drag and drop toolkit for React
- **📊 Recharts** - Redefined chart library built with React and D3
- **🖼️ Sharp** - High performance image processing

### 🌍 Utilities

- **📅 Date-fns** - Modern JavaScript date utility library
- **🪝 ReactUse** - Collection of essential React hooks for modern development

## 🎯 Fitur Utama

- **📊 Dashboard** - Visualisasi data absensi dan statistik
- **👥 Manajemen Siswa** - Tambah, edit, hapus data siswa
- **📅 Absensi Harian** - Pencatatan kehadiran siswa per hari
- **🏫 Manajemen Kelas** - Pengaturan dan pengelolaan kelas
- **🖨️ Kartu Pelajar** - Generate kartu pelajar dengan template
- **📈 Statistik** - Laporan dan grafik kehadiran
- **⚙️ Pengaturan** - Konfigurasi aplikasi

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun start
```

Open [http://localhost:3000](http://localhost:3000) to see your application running.

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
│   └── siabsensi/      # Komponen utama aplikasi
│   └── ui/             # shadcn/ui components
├── contexts/            # React contexts
├── hooks/               # Custom React hooks
└── lib/                 # Utility functions and configurations
```

## 🛠️ Konfigurasi Firebase

Aplikasi ini menggunakan Firebase untuk autentikasi dan database realtime. Ikuti langkah-langkah berikut untuk mengkonfigurasi:

1. Buat project di [Firebase Console](https://console.firebase.google.com)
2. Aktifkan Authentication (Email/Password)
3. Aktifkan Realtime Database atau Firestore
4. Copy konfigurasi Firebase ke file `.env`
5. Gunakan wizard setup di aplikasi untuk menghubungkan Firebase

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA.....................
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=abs.....77.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://aabs.....77-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=abs.....77
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=abs.....77.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:8d731.....................
```

## 📝 Lisensi

Dibuat dengan ❤️ untuk kebutuhan pengelolaan absensi sekolah.

---

Happy Coding! 🚀

```

```
