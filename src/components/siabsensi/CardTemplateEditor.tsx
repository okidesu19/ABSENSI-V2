'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, Save, RefreshCw, Palette, Type, Image, Layout,
  Monitor, Printer, Smartphone, Download, Eye, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

interface CardTemplate {
  id: string;
  name: string;
  headerColor1: string;
  headerColor2: string;
  accentColor: string;
  schoolName: string;
  schoolSubName: string;
  cardLabel: string;
  logoUrl?: string;
  showExpiredDate: boolean;
  showFaceIdStatus: boolean;
  showQrCode: boolean;
  showAddress: boolean;
  footerText: string;
  fontFamily: string;
  borderRadius: number;
  cardStyle: 'modern' | 'classic' | 'minimal' | 'gradient';
}

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  nama_jurusan?: string;
  jurusan: string;
  kelas: string;
  foto_profile?: string;
  expired_date?: string;
  face_descriptors?: number[][];
}

const defaultTemplates: CardTemplate[] = [
  {
    id: 'modern-blue',
    name: 'Modern Blue',
    headerColor1: '#1e40af',
    headerColor2: '#3b82f6',
    accentColor: '#fbbf24',
    schoolName: 'SMK SIABSENSI DIGITAL',
    schoolSubName: 'SEKOLAH MENENGAH KEJURUAN',
    cardLabel: 'KARTU PELAJAR',
    showExpiredDate: true,
    showFaceIdStatus: true,
    showQrCode: true,
    showAddress: true,
    footerText: 'SIABSENSI - Sistem Absensi Digital Sekolah',
    fontFamily: 'Segoe UI',
    borderRadius: 12,
    cardStyle: 'modern'
  },
  {
    id: 'classic-green',
    name: 'Classic Green',
    headerColor1: '#166534',
    headerColor2: '#22c55e',
    accentColor: '#fbbf24',
    schoolName: 'SMK SIABSENSI DIGITAL',
    schoolSubName: 'SEKOLAH MENENGAH KEJURUAN',
    cardLabel: 'KARTU PELAJAR',
    showExpiredDate: true,
    showFaceIdStatus: true,
    showQrCode: true,
    showAddress: true,
    footerText: 'SIABSENSI - Sistem Absensi Digital Sekolah',
    fontFamily: 'Georgia',
    borderRadius: 8,
    cardStyle: 'classic'
  },
  {
    id: 'gradient-purple',
    name: 'Gradient Purple',
    headerColor1: '#581c87',
    headerColor2: '#a855f7',
    accentColor: '#fbbf24',
    schoolName: 'SMK SIABSENSI DIGITAL',
    schoolSubName: 'SEKOLAH MENENGAH KEJURUAN',
    cardLabel: 'KARTU PELAJAR',
    showExpiredDate: true,
    showFaceIdStatus: true,
    showQrCode: true,
    showAddress: true,
    footerText: 'SIABSENSI - Sistem Absensi Digital Sekolah',
    fontFamily: 'Arial',
    borderRadius: 16,
    cardStyle: 'gradient'
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    headerColor1: '#1f2937',
    headerColor2: '#334155',
    accentColor: '#fbbf24',
    schoolName: 'SMK SIABSENSI DIGITAL',
    schoolSubName: 'SEKOLAH MENENGAH KEJURUAN',
    cardLabel: 'KARTU PELAJAR',
    showExpiredDate: true,
    showFaceIdStatus: true,
    showQrCode: true,
    showAddress: true,
    footerText: 'SIABSENSI - Sistem Absensi Digital Sekolah',
    fontFamily: 'Helvetica',
    borderRadius: 4,
    cardStyle: 'minimal'
  }
];

export default function CardTemplateEditor() {
  const router = useRouter();
  const [templates, setTemplates] = useState<CardTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>(defaultTemplates[0]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewReady, setPreviewReady] = useState(false);

  // Load students for preview
  useEffect(() => {
    const studentsRef = ref(database, 'students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const studentList: Student[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<Student, 'id'>)
        }));
        setStudents(studentList);
        if (studentList.length > 0 && !previewStudent) {
          setPreviewStudent(studentList[0]);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load saved templates
  useEffect(() => {
    const templatesRef = ref(database, 'cardTemplates');
    onValue(templatesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const savedTemplates = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<CardTemplate, 'id'>)
        }));
        setTemplates([...defaultTemplates, ...savedTemplates]);
      }
    });
  }, []);

  // Generate preview card
  const generatePreviewCard = useCallback(async () => {
    if (!previewCanvasRef.current || !previewStudent) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 2;
    const width = 540 * scale;
    const height = 340 * scale;
    canvas.width = width;
    canvas.height = height;

    const template = selectedTemplate;

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

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Style-specific backgrounds
    if (template.cardStyle === 'gradient') {
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#faf5ff');
      bgGradient.addColorStop(1, '#f3e8ff');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
    } else if (template.cardStyle === 'minimal') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
    }

    // Header
    const headerGradient = ctx.createLinearGradient(0, 0, width, 80 * scale);
    headerGradient.addColorStop(0, template.headerColor1);
    headerGradient.addColorStop(1, template.headerColor2);
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, 75 * scale);

    // School logo placeholder
    const logoX = 25 * scale;
    const logoY = 15 * scale;
    const logoSize = 45 * scale;
    
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    
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
    ctx.font = `bold ${18 * scale}px "${template.fontFamily}", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(template.schoolName, width / 2, 32 * scale);
    
    ctx.font = `${10 * scale}px "${template.fontFamily}", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(template.schoolSubName, width / 2, 50 * scale);

    // Card label badge
    const badgeX = width - 110 * scale;
    const badgeY = 18 * scale;
    fillRoundRect(badgeX, badgeY, 90 * scale, 30 * scale, 6 * scale, template.accentColor);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = `bold ${9 * scale}px "${template.fontFamily}", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(template.cardLabel, badgeX + 45 * scale, badgeY + 20 * scale);

    // Photo area
    const contentY = 85 * scale;
    const photoWidth = 100 * scale;
    const photoHeight = 125 * scale;
    const photoX = 25 * scale;
    const photoY = contentY;

    fillRoundRect(photoX, photoY, photoWidth, photoHeight, 8 * scale, '#f1f5f9');
    strokeRoundRect(photoX, photoY, photoWidth, photoHeight, 8 * scale, template.headerColor1, 2 * scale);

    if (previewStudent.foto_profile) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX + 2 * scale, photoY + 2 * scale, photoWidth - 4 * scale, photoHeight - 4 * scale, 6 * scale);
        ctx.clip();
        ctx.drawImage(img, photoX + 2 * scale, photoY + 2 * scale, photoWidth - 4 * scale, photoHeight - 4 * scale);
        ctx.restore();
      };
      img.src = previewStudent.foto_profile;
    } else {
      ctx.fillStyle = template.headerColor1;
      ctx.fillRect(photoX + 2 * scale, photoY + 2 * scale, photoWidth - 4 * scale, photoHeight - 4 * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `bold ${36 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(previewStudent.nama_lengkap.charAt(0).toUpperCase(), photoX + photoWidth / 2, photoY + photoHeight / 2 + 12 * scale);
    }

    // Info section
    const infoX = 140 * scale;
    let infoY = contentY + 18 * scale;
    const lineHeight = 22 * scale;
    const labelWidth = 90 * scale;

    const drawInfoRow = (label: string, value: string, y: number, highlight: boolean = false) => {
      ctx.fillStyle = '#64748b';
      ctx.font = `${10 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label, infoX, y);
      ctx.fillText(':', infoX + labelWidth, y);
      ctx.fillStyle = highlight ? template.headerColor1 : '#1e293b';
      ctx.font = `${highlight ? 'bold ' : ''}${11 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.fillText(value, infoX + labelWidth + 8 * scale, y);
    };

    drawInfoRow('NIS', previewStudent.nis, infoY, true);
    infoY += lineHeight;
    
    const displayName = previewStudent.nama_lengkap.length > 25 ? previewStudent.nama_lengkap.substring(0, 25) + '...' : previewStudent.nama_lengkap;
    drawInfoRow('Nama Lengkap', displayName, infoY);
    infoY += lineHeight;
    
    fillRoundRect(infoX + labelWidth + 8 * scale, infoY - 10 * scale, 85 * scale, 18 * scale, 4 * scale, '#dbeafe');
    ctx.fillStyle = template.headerColor1;
    ctx.font = `bold ${9 * scale}px "${template.fontFamily}", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${previewStudent.jurusan} - ${previewStudent.kelas}`, infoX + labelWidth + 50 * scale, infoY + 4 * scale);
    ctx.textAlign = 'left';
    infoY += lineHeight;

    // Face ID status
    if (template.showFaceIdStatus) {
      const hasFaceId = previewStudent.face_descriptors && previewStudent.face_descriptors.length > 0;
      fillRoundRect(infoX + labelWidth + 8 * scale, infoY - 10 * scale, hasFaceId ? 80 * scale : 100 * scale, 18 * scale, 4 * scale, hasFaceId ? '#dcfce7' : '#fef2f2');
      ctx.fillStyle = hasFaceId ? '#16a34a' : '#dc2626';
      ctx.font = `bold ${8 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(hasFaceId ? '✓ TERDAFTAR' : '✗ BELUM TERDAFTAR', infoX + labelWidth + (hasFaceId ? 48 : 58) * scale, infoY + 4 * scale);
      ctx.textAlign = 'left';
      infoY += lineHeight;
    }

    // Address placeholder
    if (template.showAddress) {
      drawInfoRow('Alamat', '____________________', infoY);
    }

    // QR Code
    if (template.showQrCode) {
      const qrSize = 75 * scale;
      const qrX = width - qrSize - 25 * scale;
      const qrY = contentY + 5 * scale;

      fillRoundRect(qrX - 5 * scale, qrY - 5 * scale, qrSize + 10 * scale, qrSize + 10 * scale, 6 * scale, '#ffffff');
      strokeRoundRect(qrX - 5 * scale, qrY - 5 * scale, qrSize + 10 * scale, qrSize + 10 * scale, 6 * scale, '#e2e8f0', 1 * scale);

      try {
        const qrDataUrl = await QRCode.toDataURL(previewStudent.id, {
          width: qrSize,
          margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' }
        });
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        };
        qrImg.src = qrDataUrl;
      } catch (err) {
        console.error('Error generating QR:', err);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = `${7 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SCAN UNTUK ABSENSI', qrX + qrSize / 2, qrY + qrSize + 12 * scale);
    }

    // Expired date
    if (template.showExpiredDate) {
      const expY = height - 60 * scale;
      fillRoundRect(infoX, expY, 180 * scale, 30 * scale, 5 * scale, '#f0fdf4');
      strokeRoundRect(infoX, expY, 180 * scale, 30 * scale, 5 * scale, '#22c55e', 1 * scale);
      
      ctx.fillStyle = '#64748b';
      ctx.font = `${8 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Berlaku Hingga:', infoX + 8 * scale, expY + 12 * scale);
      
      ctx.fillStyle = '#16a34a';
      ctx.font = `bold ${10 * scale}px "${template.fontFamily}", Arial, sans-serif`;
      const expDate = previewStudent.expired_date 
        ? new Date(previewStudent.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '31 Desember ' + (new Date().getFullYear() + 3);
      ctx.fillText(expDate, infoX + 8 * scale, expY + 24 * scale);
    }

    // Footer
    const footerGradient = ctx.createLinearGradient(0, height - 35 * scale, width, height);
    footerGradient.addColorStop(0, template.headerColor1);
    footerGradient.addColorStop(1, template.headerColor2);
    ctx.fillStyle = footerGradient;
    ctx.fillRect(0, height - 35 * scale, width, 35 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${8 * scale}px "${template.fontFamily}", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(template.footerText, width / 2, height - 15 * scale);

    setPreviewReady(true);
  }, [selectedTemplate, previewStudent]);

  // Generate preview when template or student changes
  useEffect(() => {
    const timer = setTimeout(() => {
      generatePreviewCard();
    }, 100);
    return () => clearTimeout(timer);
  }, [generatePreviewCard]);

  // Save template
  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const templateData = { ...selectedTemplate };
      if (defaultTemplates.find(t => t.id === selectedTemplate.id)) {
        // It's a default template, create a copy
        templateData.id = `custom-${Date.now()}`;
      }
      
      await update(ref(database, `cardTemplates/${templateData.id}`), templateData);
      toast.success('Template berhasil disimpan');
      setShowSuccess(true);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Terjadi kesalahan saat menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  // Download preview
  const handleDownloadPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `template-${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Preview berhasil diunduh');
  };

  const updateTemplate = (key: keyof CardTemplate, value: any) => {
    setSelectedTemplate(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Editor Template Kartu</h1>
              <p className="text-sm text-slate-500">Kustomisasi desain kartu pelajar</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Template Selection & Settings */}
          <div className="space-y-6">
            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layout className="w-5 h-5 text-blue-600" />
                  Pilih Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedTemplate.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div 
                        className="h-8 rounded mb-2"
                        style={{ background: `linear-gradient(to right, ${template.headerColor1}, ${template.headerColor2})` }}
                      />
                      <p className="font-medium text-sm">{template.name}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{template.cardStyle}</Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Template Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5 text-blue-600" />
                  Pengaturan Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="colors">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="colors">Warna</TabsTrigger>
                    <TabsTrigger value="text">Teks</TabsTrigger>
                    <TabsTrigger value="layout">Layout</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="colors" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Warna Header 1</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedTemplate.headerColor1}
                            onChange={(e) => updateTemplate('headerColor1', e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={selectedTemplate.headerColor1}
                            onChange={(e) => updateTemplate('headerColor1', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Warna Header 2</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedTemplate.headerColor2}
                            onChange={(e) => updateTemplate('headerColor2', e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={selectedTemplate.headerColor2}
                            onChange={(e) => updateTemplate('headerColor2', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2 col-span-2">
                        <Label>Warna Aksen (Badge)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedTemplate.accentColor}
                            onChange={(e) => updateTemplate('accentColor', e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={selectedTemplate.accentColor}
                            onChange={(e) => updateTemplate('accentColor', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="text" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nama Sekolah</Label>
                        <Input
                          value={selectedTemplate.schoolName}
                          onChange={(e) => updateTemplate('schoolName', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Sub Nama Sekolah</Label>
                        <Input
                          value={selectedTemplate.schoolSubName}
                          onChange={(e) => updateTemplate('schoolSubName', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Label Kartu</Label>
                        <Input
                          value={selectedTemplate.cardLabel}
                          onChange={(e) => updateTemplate('cardLabel', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Teks Footer</Label>
                        <Input
                          value={selectedTemplate.footerText}
                          onChange={(e) => updateTemplate('footerText', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Font Family</Label>
                        <Select 
                          value={selectedTemplate.fontFamily} 
                          onValueChange={(v) => updateTemplate('fontFamily', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Segoe UI">Segoe UI</SelectItem>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Georgia">Georgia</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Verdana">Verdana</SelectItem>
                            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="layout" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Style Kartu</Label>
                        <Select 
                          value={selectedTemplate.cardStyle} 
                          onValueChange={(v) => updateTemplate('cardStyle', v as CardTemplate['cardStyle'])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="modern">Modern</SelectItem>
                            <SelectItem value="classic">Classic</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="gradient">Gradient</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Border Radius: {selectedTemplate.borderRadius}px</Label>
                        <input
                          type="range"
                          min="0"
                          max="24"
                          value={selectedTemplate.borderRadius}
                          onChange={(e) => updateTemplate('borderRadius', parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Elemen yang Ditampilkan</Label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplate.showExpiredDate}
                              onChange={(e) => updateTemplate('showExpiredDate', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Tanggal Expired</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplate.showFaceIdStatus}
                              onChange={(e) => updateTemplate('showFaceIdStatus', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Status Face ID</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplate.showQrCode}
                              onChange={(e) => updateTemplate('showQrCode', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">QR Code</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplate.showAddress}
                              onChange={(e) => updateTemplate('showAddress', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Alamat</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Preview Student Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  Preview Siswa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={previewStudent?.id || ''} 
                  onValueChange={(id) => setPreviewStudent(students.find(s => s.id === id) || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih siswa untuk preview" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.nama_lengkap} - {student.nis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-blue-600" />
                  Preview Kartu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-100 rounded-xl p-4">
                  <canvas
                    ref={previewCanvasRef}
                    className="w-full h-auto rounded-lg shadow-lg"
                    style={{ aspectRatio: '1.586' }}
                  />
                  {!previewReady && (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Ekspor Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={handleDownloadPreview}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PNG
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={saving}>
                    {saving ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Simpan Template
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Template yang disimpan akan digunakan untuk generate kartu pelajar
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Berhasil!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Template kartu berhasil disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSuccess(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
