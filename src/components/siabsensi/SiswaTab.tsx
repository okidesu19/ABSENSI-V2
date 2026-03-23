'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, Search, MoreVertical, Eye, Pencil, FileText, Trash2, 
  RefreshCw, Users, Grid, List, CheckCircle, XCircle,
  Download, Printer, Mail, Phone, Calendar, IdCard, Clock,
  GraduationCap, Award, QrCode, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  nama_jurusan?: string;
  jurusan: string;
  kelas: string;
  email?: string;
  nomor_hp?: string;
  pin: string;
  face_descriptors?: number[][];
  foto_profile?: string;
  expired_date?: string;
  created_at: number;
  updated_at?: number;
}

interface ClassData {
  id: string;
  nama_jurusan: string;
  singkatan: string;
  label: Record<string, { kelas: string[] }>;
  created_at: number;
}

interface ParsedLabel {
  jurusanCode: string;
  namaJurusan: string;
  singkatan: string;
  labelNum: number;
  kelas: string[];
}

const tingkatOptions = ['X', 'XI', 'XII'];

export default function SiswaTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJurusan, setFilterJurusan] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Detail dialog state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  
  // Card generator state
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [cardStudent, setCardStudent] = useState<Student | null>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cardImageReady, setCardImageReady] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const studentsRef = ref(database, 'students');
    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const studentList: Student[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<Student, 'id'>)
        }));
        setStudents(studentList);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    const classesRef = ref(database, 'classes');
    const unsubscribeClasses = onValue(classesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const classList: ClassData[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<ClassData, 'id'>)
        }));
        setClasses(classList);
      } else {
        setClasses([]);
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeClasses();
    };
  }, []);

  const parsedLabels: ParsedLabel[] = classes.flatMap(cls => {
    if (!cls.label) return [];
    const labelEntries = Object.values(cls.label);
    return labelEntries.map((labelData, index) => {
      const labelNum = index + 1;
      return {
        jurusanCode: `${cls.singkatan} ${labelNum}`,
        namaJurusan: cls.nama_jurusan,
        singkatan: cls.singkatan,
        labelNum,
        kelas: labelData.kelas || []
      };
    });
  });

  const uniqueJurusanCodes = [...new Set(parsedLabels.map(l => l.jurusanCode))].sort();

  const availableKelas = filterJurusan === 'all' 
    ? tingkatOptions 
    : parsedLabels.find(l => l.jurusanCode === filterJurusan)?.kelas || tingkatOptions;

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.nis.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJurusan = filterJurusan === 'all' || student.jurusan === filterJurusan;
    const matchesKelas = filterKelas === 'all' || student.kelas === filterKelas;
    return matchesSearch && matchesJurusan && matchesKelas;
  });

  const handleDelete = async () => {
    if (!deletingStudent) return;

    try {
      await remove(ref(database, `students/${deletingStudent.id}`));
      toast.success('Siswa berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setDeletingStudent(null);
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Terjadi kesalahan saat menghapus data');
    }
  };

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailDialogOpen(true);
  };

  const handleGenerateCard = (student: Student) => {
    setCardStudent(student);
    setCardImageReady(false);
    setIsCardDialogOpen(true);
  };

  const handleEdit = (student: Student) => {
    router.push(`/?edit=${student.id}`);
  };

  const hasFaceId = useCallback((student: Student) => {
    return student.face_descriptors && student.face_descriptors.length > 0;
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const formatExpiredDate = useCallback((dateStr?: string) => {
    if (!dateStr) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 3);
      return defaultDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const isExpired = useCallback((dateStr?: string) => {
    if (!dateStr) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 3);
      return new Date() > defaultDate;
    }
    return new Date() > new Date(dateStr);
  }, []);

  // Generate student card - Modern KTP Style
  const generateStudentCard = useCallback(async (student: Student) => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 3;
    const width = 540 * scale;
    const height = 340 * scale;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Helper functions
    const fillRoundRect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const strokeRoundRect = (x: number, y: number, w: number, h: number, r: number, color: string, lineWidth: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    // Background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#ffffff');
    bgGradient.addColorStop(0.5, '#f8fafc');
    bgGradient.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative corner
    ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(100 * scale, 0);
    ctx.lineTo(0, 100 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width, height);
    ctx.lineTo(width - 100 * scale, height);
    ctx.lineTo(width, height - 100 * scale);
    ctx.closePath();
    ctx.fill();

    // Header with gradient
    const headerGradient = ctx.createLinearGradient(0, 0, width, 85 * scale);
    headerGradient.addColorStop(0, '#1e40af');
    headerGradient.addColorStop(0.5, '#2563eb');
    headerGradient.addColorStop(1, '#1e40af');
    ctx.fillStyle = headerGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, 75 * scale);
    ctx.quadraticCurveTo(width * 0.7, 85 * scale, 0, 70 * scale);
    ctx.closePath();
    ctx.fill();

    // School logo circle
    const logoX = 30 * scale;
    const logoY = 15 * scale;
    const logoSize = 45 * scale;
    
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    
    // School building icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(logoX + 12 * scale, logoY + 35 * scale);
    ctx.lineTo(logoX + 12 * scale, logoY + 20 * scale);
    ctx.lineTo(logoX + logoSize / 2, logoY + 8 * scale);
    ctx.lineTo(logoX + 33 * scale, logoY + 20 * scale);
    ctx.lineTo(logoX + 33 * scale, logoY + 35 * scale);
    ctx.closePath();
    ctx.fill();

    // School name
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${20 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SMK SIABSENSI DIGITAL', width / 2, 35 * scale);
    
    ctx.font = `${11 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('SEKOLAH MENENGAH KEJURUAN', width / 2, 55 * scale);

    // Card type badge
    const badgeX = width - 115 * scale;
    const badgeY = 18 * scale;
    const badgeW = 95 * scale;
    const badgeH = 32 * scale;
    
    const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    badgeGradient.addColorStop(0, '#fbbf24');
    badgeGradient.addColorStop(1, '#f59e0b');
    fillRoundRect(badgeX, badgeY, badgeW, badgeH, 8 * scale, badgeGradient);
    
    ctx.fillStyle = '#1e3a5f';
    ctx.font = `bold ${10 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('KARTU PELAJAR', badgeX + badgeW / 2, badgeY + 21 * scale);

    // Main content
    const contentY = 95 * scale;
    const leftMargin = 28 * scale;

    // Photo area with modern design
    const photoWidth = 110 * scale;
    const photoHeight = 135 * scale;
    const photoX = leftMargin;
    const photoY = contentY;

    // Photo shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 12 * scale;
    ctx.shadowOffsetX = 2 * scale;
    ctx.shadowOffsetY = 2 * scale;
    
    fillRoundRect(photoX, photoY, photoWidth, photoHeight, 10 * scale, '#ffffff');
    ctx.shadowColor = 'transparent';
    
    strokeRoundRect(photoX, photoY, photoWidth, photoHeight, 10 * scale, '#e2e8f0', 2 * scale);

    // Load and draw photo
    const photoLoaded = new Promise<void>((resolve) => {
      if (student.foto_profile) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX + 3 * scale, photoY + 3 * scale, photoWidth - 6 * scale, photoHeight - 6 * scale, 8 * scale);
          ctx.clip();
          // Draw with object-cover behavior
          const imgRatio = img.width / img.height;
          const targetRatio = photoWidth / photoHeight;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          
          if (imgRatio > targetRatio) {
            sw = img.height * targetRatio;
            sx = (img.width - sw) / 2;
          } else {
            sh = img.width / targetRatio;
            sy = (img.height - sh) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, photoX + 3 * scale, photoY + 3 * scale, photoWidth - 6 * scale, photoHeight - 6 * scale);
          ctx.restore();
          resolve();
        };
        img.onerror = () => {
          drawPlaceholder();
          resolve();
        };
        img.src = student.foto_profile;
      } else {
        drawPlaceholder();
        resolve();
      }
    });

    function drawPlaceholder() {
      const photoGradient = ctx.createLinearGradient(photoX, photoY, photoX + photoWidth, photoY + photoHeight);
      photoGradient.addColorStop(0, '#3b82f6');
      photoGradient.addColorStop(1, '#1d4ed8');
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX + 3 * scale, photoY + 3 * scale, photoWidth - 6 * scale, photoHeight - 6 * scale, 8 * scale);
      ctx.clip();
      ctx.fillStyle = photoGradient;
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `bold ${42 * scale}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(student.nama_lengkap.charAt(0).toUpperCase(), photoX + photoWidth / 2, photoY + photoHeight / 2 + 14 * scale);
      ctx.restore();
    }

    // Photo label
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${8 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('FOTO 3x4', photoX + photoWidth / 2, photoY + photoHeight + 12 * scale);

    // Student Info Section
    const infoX = 160 * scale;
    let infoY = contentY + 22 * scale;
    const lineHeight = 26 * scale;
    const labelWidth = 85 * scale;

    // Info row drawing function
    const drawInfoRow = (label: string, value: string, y: number, highlight: boolean = false) => {
      ctx.fillStyle = '#64748b';
      ctx.font = `${11 * scale}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label, infoX, y);
      ctx.fillText(':', infoX + labelWidth, y);
      ctx.fillStyle = highlight ? '#1e40af' : '#1e293b';
      ctx.font = `${highlight ? 'bold ' : ''}${12 * scale}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(value, infoX + labelWidth + 10 * scale, y);
    };

    // NIS
    drawInfoRow('NIS', student.nis, infoY, true);
    infoY += lineHeight;

    // Name
    const displayName = student.nama_lengkap.length > 28 
      ? student.nama_lengkap.substring(0, 28) + '...' 
      : student.nama_lengkap;
    drawInfoRow('NAMA', displayName, infoY);
    infoY += lineHeight;

    // Class with badge style
    ctx.fillStyle = '#64748b';
    ctx.font = `${11 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('KELAS', infoX, infoY);
    ctx.fillText(':', infoX + labelWidth, infoY);
    
    const classBadgeX = infoX + labelWidth + 10 * scale;
    const classBadgeY = infoY - 12 * scale;
    fillRoundRect(classBadgeX, classBadgeY, 75 * scale, 20 * scale, 5 * scale, '#dbeafe');
    ctx.fillStyle = '#1e40af';
    ctx.font = `bold ${10 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${student.kelas}`, classBadgeX + 37.5 * scale, classBadgeY + 14 * scale);
    ctx.textAlign = 'left';
    infoY += lineHeight;

    // Jurusan
    const jurusanName = student.nama_jurusan || student.jurusan;
    const displayJurusan = jurusanName.length > 26 
      ? jurusanName.substring(0, 26) + '...' 
      : jurusanName;
    drawInfoRow('JURUSAN', displayJurusan, infoY);
    infoY += lineHeight;

    // Expired Date
    ctx.fillStyle = '#64748b';
    ctx.font = `${11 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('EXPIRED', infoX, infoY);
    ctx.fillText(':', infoX + labelWidth, infoY);
    
    const expText = formatExpiredDate(student.expired_date);
    const isCardExpired = isExpired(student.expired_date);
    
    ctx.fillStyle = isCardExpired ? '#dc2626' : '#16a34a';
    ctx.font = `bold ${11 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(expText, infoX + labelWidth + 10 * scale, infoY);

    // QR Code Section
    const qrSize = 80 * scale;
    const qrX = width - qrSize - 30 * scale;
    const qrY = contentY + 5 * scale;

    // QR background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetX = 2 * scale;
    ctx.shadowOffsetY = 2 * scale;
    fillRoundRect(qrX - 6 * scale, qrY - 6 * scale, qrSize + 12 * scale, qrSize + 12 * scale, 8 * scale, '#ffffff');
    ctx.shadowColor = 'transparent';
    strokeRoundRect(qrX - 6 * scale, qrY - 6 * scale, qrSize + 12 * scale, qrSize + 12 * scale, 8 * scale, '#e2e8f0', 1.5 * scale);

    // Generate QR
    try {
      const qrDataUrl = await QRCode.toDataURL(student.id, {
        width: qrSize,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
      const qrImg = new window.Image();
      qrImg.onload = () => {
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      };
      qrImg.src = qrDataUrl;
    } catch (err) {
      console.error('Error generating QR:', err);
    }

    // QR label
    ctx.fillStyle = '#64748b';
    ctx.font = `${7 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SCAN UNTUK ABSENSI', qrX + qrSize / 2, qrY + qrSize + 14 * scale);

    // Card status indicator
    if (isCardExpired) {
      const statusX = width - 130 * scale;
      const statusY = height - 65 * scale;
      fillRoundRect(statusX, statusY, 100 * scale, 24 * scale, 5 * scale, '#fef2f2');
      strokeRoundRect(statusX, statusY, 100 * scale, 24 * scale, 5 * scale, '#ef4444', 1.5 * scale);
      ctx.fillStyle = '#dc2626';
      ctx.font = `bold ${8 * scale}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('KARTU EXPIRED', statusX + 50 * scale, statusY + 16 * scale);
    }

    // Footer
    const footerGradient = ctx.createLinearGradient(0, height - 40 * scale, width, height);
    footerGradient.addColorStop(0, '#1e40af');
    footerGradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = footerGradient;
    ctx.fillRect(0, height - 40 * scale, width, 40 * scale);

    // Footer decorative line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20 * scale, height - 40 * scale);
    ctx.lineTo(width - 20 * scale, height - 40 * scale);
    ctx.stroke();

    // Footer text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${9 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SIABSENSI - Sistem Absensi Digital Sekolah', width / 2, height - 22 * scale);
    ctx.font = `${8 * scale}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`Dicetak: ${formatDate(Date.now())} | ID: ${student.id.substring(0, 8).toUpperCase()}`, width / 2, height - 10 * scale);

    await photoLoaded;
    setCardImageReady(true);
  }, [formatDate, formatExpiredDate, isExpired]);

  // Generate card when dialog opens
  useEffect(() => {
    if (cardStudent && isCardDialogOpen) {
      const timer = setTimeout(() => {
        if (cardCanvasRef.current) {
          generateStudentCard(cardStudent);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [cardStudent, isCardDialogOpen, generateStudentCard]);

  // Download card
  const downloadCard = () => {
    const canvas = cardCanvasRef.current;
    if (!canvas || !cardStudent) return;

    const link = document.createElement('a');
    link.download = `kartu-siswa-${cardStudent.nis}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Kartu siswa berhasil diunduh');
  };

  // Print card
  const printCard = () => {
    const canvas = cardCanvasRef.current;
    if (!canvas || !cardStudent) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kartu Siswa - ${cardStudent.nama_lengkap}</title>
          <style>
            body { 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0;
              font-family: Arial, sans-serif;
              background: #f5f5f5;
            }
            img { max-width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px; }
            @media print {
              body { margin: 0; background: white; }
              img { box-shadow: none; }
              @page { size: auto; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Kartu Siswa" />
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Siswa</h1>
          <p className="text-slate-500 mt-1">Kelola data siswa dan Face ID</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => router.push('/?template=card')} 
            variant="outline"
            className="gap-2 border-slate-200 hover:bg-slate-50"
          >
            <IdCard className="w-4 h-4" />
            Template Kartu
          </Button>
          <Button 
            onClick={() => router.push('/?add=student')} 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Siswa
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cari NIS atau Nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterJurusan} onValueChange={(value) => {
                setFilterJurusan(value);
                setFilterKelas('all');
              }}>
                <SelectTrigger className="w-[150px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Jurusan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jurusan</SelectItem>
                  {uniqueJurusanCodes.map((code, index) => (
                    <SelectItem key={`jurusan-filter-${code}-${index}`} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className="w-[120px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {availableKelas.sort((a, b) => tingkatOptions.indexOf(a) - tingkatOptions.indexOf(b)).map((k, index) => (
                    <SelectItem key={`kelas-filter-${k}-${index}`} value={k}>Kelas {k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex border rounded-lg overflow-hidden border-slate-200">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('table')}
                  className="rounded-none"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p>{students.length === 0 ? 'Belum ada data siswa' : 'Tidak ada siswa yang cocok dengan filter'}</p>
              {students.length === 0 && (
                <Button variant="link" onClick={() => router.push('/?add=student')} className="mt-2">
                  Tambah siswa pertama
                </Button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-bold text-slate-700">Foto</TableHead>
                    <TableHead className="font-bold text-slate-700">NIS</TableHead>
                    <TableHead className="font-bold text-slate-700">Nama</TableHead>
                    <TableHead className="font-bold text-slate-700">Kelas</TableHead>
                    <TableHead className="text-center font-bold text-slate-700">Face ID</TableHead>
                    <TableHead className="text-center font-bold text-slate-700">Status Kartu</TableHead>
                    <TableHead className="text-center font-bold text-slate-700">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <TableCell>
                        <Avatar className="w-10 h-10 ring-2 ring-slate-100">
                          <AvatarImage src={student.foto_profile} alt={student.nama_lengkap} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                            {student.nama_lengkap.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-mono text-slate-600">{student.nis}</TableCell>
                      <TableCell className="font-semibold text-slate-800">{student.nama_lengkap}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 border-slate-200 font-medium">
                          {student.jurusan} - {student.kelas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {hasFaceId(student) ? (
                          <Badge className="bg-green-100 text-green-700 border border-green-200 font-medium">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Terdaftar
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border border-red-200 font-medium">
                            <XCircle className="w-3 h-3 mr-1" />
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isExpired(student.expired_date) ? (
                          <Badge className="bg-red-100 text-red-700 border border-red-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border border-green-200">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 shadow-lg border-slate-200 rounded-xl">
                            <DropdownMenuItem onClick={() => handleViewDetail(student)} className="cursor-pointer py-2.5">
                              <Eye className="w-4 h-4 mr-2 text-blue-600" />
                              <span className="font-medium">Lihat Detail</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(student)} className="cursor-pointer py-2.5">
                              <Pencil className="w-4 h-4 mr-2 text-purple-600" />
                              <span className="font-medium">Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateCard(student)} className="cursor-pointer py-2.5">
                              <FileText className="w-4 h-4 mr-2 text-green-600" />
                              <span className="font-medium">Generate Kartu</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setDeletingStudent(student);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-600 focus:text-red-600 cursor-pointer py-2.5"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              <span className="font-medium">Hapus</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredStudents.map((student) => (
                <Card key={student.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                  <div className="aspect-square bg-slate-100 relative">
                    {student.foto_profile ? (
                      <img 
                        src={student.foto_profile} 
                        alt={student.nama_lengkap}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                        <span className="text-4xl font-bold text-blue-400">
                          {student.nama_lengkap.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {hasFaceId(student) ? (
                        <Badge className="bg-green-500/90 text-white text-xs backdrop-blur-sm">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Face ID
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/90 text-white text-xs backdrop-blur-sm">
                          <XCircle className="w-3 h-3 mr-1" />
                          No Face ID
                        </Badge>
                      )}
                      {isExpired(student.expired_date) && (
                        <Badge className="bg-red-600/90 text-white text-xs backdrop-blur-sm">
                          <Clock className="w-3 h-3 mr-1" />
                          Expired
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="font-semibold text-slate-800 truncate">{student.nama_lengkap}</p>
                    <p className="text-sm text-slate-500">{student.nis}</p>
                    <p className="text-xs text-slate-400 mt-1">{student.jurusan} - {student.kelas}</p>
                    <div className="flex gap-1 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 border-slate-200 hover:bg-slate-50"
                        onClick={() => handleViewDetail(student)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Detail
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 border-slate-200 hover:bg-slate-50"
                        onClick={() => handleEdit(student)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleGenerateCard(student)}
                      >
                        <IdCard className="w-3 h-3 mr-1" />
                        Kartu
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Dialog - Modern Design */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          {selectedStudent && (
            <>
              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-4 border-white/30 shadow-xl">
                      <AvatarImage src={selectedStudent.foto_profile} alt={selectedStudent.nama_lengkap} className="object-cover" />
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl">
                        {selectedStudent.nama_lengkap.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {hasFaceId(selectedStudent) && (
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <DialogTitle className="text-xl font-bold mt-4">{selectedStudent.nama_lengkap}</DialogTitle>
                  <DialogDescription className="text-blue-200 mt-1">NIS: {selectedStudent.nis}</DialogDescription>
                  <div className="flex gap-2 mt-3">
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                      {selectedStudent.jurusan}
                    </Badge>
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                      Kelas {selectedStudent.kelas}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Info Cards */}
              <div className="p-4 space-y-3 bg-gradient-to-b from-slate-50 to-white">
                {selectedStudent.nama_jurusan && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Jurusan</p>
                      <p className="font-medium text-slate-800">{selectedStudent.nama_jurusan}</p>
                    </div>
                  </div>
                )}

                {selectedStudent.email && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium text-slate-800">{selectedStudent.email}</p>
                    </div>
                  </div>
                )}

                {selectedStudent.nomor_hp && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">No. HP</p>
                      <p className="font-medium text-slate-800">{selectedStudent.nomor_hp}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Terdaftar</p>
                    <p className="font-medium text-slate-800">{formatDate(selectedStudent.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasFaceId(selectedStudent) ? 'bg-gradient-to-br from-green-100 to-green-200' : 'bg-gradient-to-br from-red-100 to-red-200'}`}>
                    {hasFaceId(selectedStudent) ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Face ID</p>
                    <p className={`font-medium ${hasFaceId(selectedStudent) ? 'text-green-600' : 'text-red-600'}`}>
                      {hasFaceId(selectedStudent) ? `Terdaftar (${selectedStudent.face_descriptors?.length} sample)` : 'Belum Terdaftar'}
                    </p>
                  </div>
                </div>

                {/* Card Status */}
                <div className={`flex items-center gap-3 p-3 rounded-xl shadow-sm border ${isExpired(selectedStudent.expired_date) ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired(selectedStudent.expired_date) ? 'bg-gradient-to-br from-red-100 to-red-200' : 'bg-gradient-to-br from-green-100 to-green-200'}`}>
                    <IdCard className={`w-5 h-5 ${isExpired(selectedStudent.expired_date) ? 'text-red-600' : 'text-green-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Kartu Berlaku Hingga</p>
                    <p className={`font-medium ${isExpired(selectedStudent.expired_date) ? 'text-red-600' : 'text-green-600'}`}>
                      {formatExpiredDate(selectedStudent.expired_date)}
                      {isExpired(selectedStudent.expired_date) && ' (Expired)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 pt-0 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-slate-200 hover:bg-slate-50"
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    handleEdit(selectedStudent);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    handleGenerateCard(selectedStudent);
                  }}
                >
                  <IdCard className="w-4 h-4 mr-2" />
                  Generate Kartu
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Card Generator Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={(open) => {
        setIsCardDialogOpen(open);
        if (!open) {
          setCardStudent(null);
          setCardImageReady(false);
        }
      }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
            <DialogTitle className="flex items-center gap-2 text-white">
              <IdCard className="w-5 h-5" />
              Kartu Pelajar
            </DialogTitle>
            <DialogDescription className="text-blue-200">
              {cardStudent?.nama_lengkap} - {cardStudent?.nis}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-50">
            <div className="bg-white rounded-xl shadow-xl p-2 overflow-hidden">
              <canvas
                ref={cardCanvasRef}
                className="w-full h-auto rounded-lg"
                style={{ aspectRatio: '1.586' }}
              />
              {!cardImageReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 flex gap-2 bg-white border-t">
            <Button 
              variant="outline" 
              className="flex-1 border-slate-200 hover:bg-slate-50"
              onClick={downloadCard}
              disabled={!cardImageReady}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            <Button 
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
              onClick={printCard}
              disabled={!cardImageReady}
            >
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-0 shadow-2xl rounded-2xl max-w-md">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-slate-800">Hapus Siswa?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 mt-2">
                Apakah Anda yakin ingin menghapus data siswa <span className="font-semibold text-slate-700">{deletingStudent?.nama_lengkap}</span>? 
                Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="px-6 pb-4">
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
