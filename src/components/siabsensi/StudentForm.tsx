'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ref, push, update, get, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  ArrowLeft, ArrowRight, Save, Camera, Upload, Link, 
  CheckCircle, XCircle, RefreshCw, User, ScanFace, Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import * as faceapi from 'face-api.js';

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

const steps = [
  { id: 1, title: 'Data Pribadi', description: 'Informasi siswa' },
  { id: 2, title: 'Foto Profile', description: 'Upload foto siswa' },
  { id: 3, title: 'Face ID', description: 'Daftarkan wajah' }
];

const tingkatOptions = ['X', 'XI', 'XII'];

// Model URLs - using reliable CDN
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

export default function StudentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;

  const [currentStep, setCurrentStep] = useState(1);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    nis: '',
    nama_lengkap: '',
    nama_jurusan: '',
    jurusan: '',
    kelas: '',
    email: '',
    nomor_hp: '',
    pin: '',
    foto_profile: '',
    expired_date: '',
    face_descriptors: [] as number[][]
  });

  // Face detection state
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [faceModelsError, setFaceModelsError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturingFace, setCapturingFace] = useState(false);
  const [faceSamples, setFaceSamples] = useState<number[][]>([]);
  const [detectingFace, setDetectingFace] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Photo upload
  const [photoMethod, setPhotoMethod] = useState<'camera' | 'upload' | 'url'>('upload');
  const [photoUrl, setPhotoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Parse labels from class data
  const parsedLabels: ParsedLabel[] = classes.flatMap(cls => {
    if (!cls.label) return [];
    const labelEntries = Object.entries(cls.label);
    return labelEntries.map(([, labelData], index) => {
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

  const sortedLabels = [...parsedLabels].sort((a, b) => 
    a.jurusanCode.localeCompare(b.jurusanCode)
  );

  // Load classes
  useEffect(() => {
    const classesRef = ref(database, 'classes');
    const unsubscribe = onValue(classesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const classList: ClassData[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<ClassData, 'id'>)
        }));
        setClasses(classList);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load student data for edit mode
  useEffect(() => {
    if (editId) {
      const studentRef = ref(database, `students/${editId}`);
      get(studentRef).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Student;
          setFormData({
            nis: data.nis,
            nama_lengkap: data.nama_lengkap,
            nama_jurusan: data.nama_jurusan || '',
            jurusan: data.jurusan,
            kelas: data.kelas,
            email: data.email || '',
            nomor_hp: data.nomor_hp || '',
            pin: data.pin,
            foto_profile: data.foto_profile || '',
            expired_date: data.expired_date || '',
            face_descriptors: data.face_descriptors || []
          });
          setFaceSamples(data.face_descriptors || []);
        }
      });
    }
  }, [editId]);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setFaceModelsError(null);
        
        // Load all required models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
        
        setFaceModelsLoaded(true);
      } catch (error) {
        console.error('Error loading face models:', error);
        setFaceModelsError('Gagal memuat model AI. Pastikan koneksi internet stabil.');
        toast.error('Gagal memuat model Face ID');
      }
    };
    loadModels();
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    
    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        }
      });
      
      // Store stream reference
      streamRef.current = stream;
      
      // Video element is always rendered, just need to set source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready and play
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const timeoutId = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, 10000);
          
          video.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            video.play()
              .then(() => resolve())
              .catch((err) => reject(err));
          };
          
          video.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Video loading error'));
          };
        });
        
        // Now activate the camera view
        setCameraActive(true);
        toast.success('Kamera aktif');
      } else {
        throw new Error('Video element tidak ditemukan');
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setCameraActive(false);
      setCameraError(error.message || 'Tidak dapat mengakses kamera');
      toast.error('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
      
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    // Clear detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setCameraActive(false);
    setFaceDetected(false);
  }, []);

  // Face detection loop
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || !faceModelsLoaded) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const detectFace = async () => {
      if (!video || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      try {
        setDetectingFace(true);
        
        // Get video dimensions
        const displaySize = { 
          width: video.videoWidth || 640, 
          height: video.videoHeight || 480 
        };
        
        // Match canvas to video
        faceapi.matchDimensions(canvas, displaySize);

        // Detect face with landmarks
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5
          }))
          .withFaceLandmarks(true); // Use tiny landmarks for better performance

        if (detection) {
          // Resize detection to match display
          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          
          // Clear canvas
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw detection box
            const drawBox = new faceapi.draw.DrawBox(resizedDetection.detection.box, {
              label: 'Wajah Terdeteksi',
              lineWidth: 2,
              boxColor: '#22c55e'
            });
            drawBox.draw(canvas);
            
            // Draw face landmarks
            new faceapi.draw.DrawFaceLandmarks(canvas, resizedDetection.landmarks, {
              drawLines: true,
              drawPoints: true,
              lineColor: '#3b82f6',
              pointColor: '#ef4444',
              lineWidth: 1,
              pointSize: 2
            });
          }
          
          setFaceDetected(true);
        } else {
          // Clear canvas if no face detected
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          setFaceDetected(false);
        }
      } catch (error) {
        console.error('Face detection error:', error);
      } finally {
        setDetectingFace(false);
      }
    };

    // Start detection loop
    detectFace(); // Initial detection
    detectionIntervalRef.current = setInterval(detectFace, 200);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [cameraActive, faceModelsLoaded]);

  // Capture face descriptor
  const captureFaceDescriptor = async () => {
    if (!videoRef.current || !faceModelsLoaded || !faceDetected) {
      toast.error('Wajah belum terdeteksi');
      return;
    }

    setCapturingFace(true);
    
    try {
      // Capture face with descriptor
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection) {
        const descriptor = Array.from(detection.descriptor);
        
        setFaceSamples(prev => {
          const newSamples = [...prev, descriptor];
          const sampleNum = newSamples.length;
          
          if (sampleNum >= 3) {
            toast.success(`Sample ${sampleNum}/3 berhasil! Pendaftaran wajah selesai.`);
            stopCamera();
          } else {
            toast.success(`Sample ${sampleNum}/3 berhasil`);
          }
          
          return newSamples;
        });
      } else {
        toast.error('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas.');
      }
    } catch (error) {
      console.error('Error capturing face:', error);
      toast.error('Terjadi kesalahan saat capture wajah');
    } finally {
      setCapturingFace(false);
    }
  };

  // Reset face samples
  const resetFaceSamples = () => {
    setFaceSamples([]);
    toast.info('Sample wajah direset');
  };

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setFormData(prev => ({ ...prev, foto_profile: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle URL photo
  const handleUrlPhoto = () => {
    if (photoUrl) {
      setFormData(prev => ({ ...prev, foto_profile: photoUrl }));
    }
  };

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.nis) newErrors.nis = 'NIS wajib diisi';
      else if (!/^\d+$/.test(formData.nis)) newErrors.nis = 'NIS harus berupa angka';
      if (!formData.nama_lengkap) newErrors.nama_lengkap = 'Nama lengkap wajib diisi';
      if (!formData.jurusan) newErrors.jurusan = 'Jurusan wajib dipilih';
      if (!formData.kelas) newErrors.kelas = 'Kelas wajib dipilih';
      if (!formData.pin) newErrors.pin = 'PIN wajib diisi';
      else if (!/^\d{6}$/.test(formData.pin)) newErrors.pin = 'PIN harus 6 digit angka';
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Format email tidak valid';
      }
    }

    if (step === 3) {
      if (faceSamples.length < 3) {
        newErrors.face = 'Minimal 3 sample wajah diperlukan';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Save student
  const handleSave = async () => {
    if (!validateStep(1) || !validateStep(3)) return;

    setSaving(true);
    try {
      const studentsRef = ref(database, 'students');
      const snapshot = await get(studentsRef);
      
      if (snapshot.exists()) {
        const students = snapshot.val() as Record<string, Student>;
        const duplicateNis = Object.entries(students).some(
          ([id, student]) => student.nis === formData.nis && id !== editId
        );
        if (duplicateNis) {
          toast.error('NIS sudah terdaftar');
          setSaving(false);
          return;
        }
      }

      // Calculate default expired_date (3 years from now) if not set
      let expiredDate = formData.expired_date;
      if (!expiredDate) {
        const defaultDate = new Date();
        defaultDate.setFullYear(defaultDate.getFullYear() + 3);
        expiredDate = defaultDate.toISOString().split('T')[0];
      }

      const studentData = {
        ...formData,
        expired_date: expiredDate,
        face_descriptors: faceSamples,
        updated_at: Date.now()
      };

      if (isEditMode && editId) {
        await update(ref(database, `students/${editId}`), studentData);
        toast.success('Data siswa berhasil diperbarui');
      } else {
        await push(ref(database, 'students'), {
          ...studentData,
          created_at: Date.now()
        });
        toast.success('Siswa baru berhasil ditambahkan');
      }

      setShowSuccess(true);
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const selectedLabel = formData.jurusan ? parsedLabels.find(l => l.jurusanCode === formData.jurusan) : null;

  const handleJurusanChange = (jurusan: string) => {
    const selected = parsedLabels.find(l => l.jurusanCode === jurusan);
    setFormData(prev => ({
      ...prev,
      jurusan: jurusan,
      nama_jurusan: selected?.namaJurusan || '',
      kelas: ''
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {isEditMode ? 'Edit Siswa' : 'Tambah Siswa Baru'}
              </h1>
              <p className="text-sm text-slate-500">Langkah {currentStep} dari 3</p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <Progress value={(currentStep / 3) * 100} className="h-2" />
            <div className="flex justify-between mt-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 text-xs ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      currentStep > step.id
                        ? 'bg-blue-600 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                  </div>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Step 1: Data Pribadi */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <CardTitle>Data Pribadi</CardTitle>
              </div>
              <CardDescription>Lengkapi informasi siswa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nis">NIS *</Label>
                  <Input
                    id="nis"
                    value={formData.nis}
                    onChange={(e) => setFormData(prev => ({ ...prev, nis: e.target.value }))}
                    placeholder="Masukkan NIS"
                    className={errors.nis ? 'border-red-500' : ''}
                  />
                  {errors.nis && <p className="text-xs text-red-500">{errors.nis}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama_lengkap}
                    onChange={(e) => setFormData(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                    placeholder="Masukkan nama lengkap"
                    className={errors.nama_lengkap ? 'border-red-500' : ''}
                  />
                  {errors.nama_lengkap && <p className="text-xs text-red-500">{errors.nama_lengkap}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jurusan">Jurusan *</Label>
                  <Select
                    value={formData.jurusan}
                    onValueChange={handleJurusanChange}
                  >
                    <SelectTrigger className={errors.jurusan ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih jurusan" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedLabels.map((label, index) => (
                        <SelectItem key={`jurusan-select-${label.jurusanCode}-${index}`} value={label.jurusanCode}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{label.jurusanCode}</span>
                            <span className="text-xs text-slate-500">{label.namaJurusan}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.jurusan && <p className="text-xs text-red-500">{errors.jurusan}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kelas">Kelas *</Label>
                  <Select
                    value={formData.kelas}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, kelas: value }))}
                    disabled={!formData.jurusan}
                  >
                    <SelectTrigger className={errors.kelas ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedLabel?.kelas.sort((a, b) => tingkatOptions.indexOf(a) - tingkatOptions.indexOf(b)).map((t, index) => (
                        <SelectItem key={`kelas-select-${t}-${index}`} value={t}>Kelas {t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.kelas && <p className="text-xs text-red-500">{errors.kelas}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Opsional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hp">Nomor HP (Opsional)</Label>
                  <Input
                    id="hp"
                    type="tel"
                    value={formData.nomor_hp}
                    onChange={(e) => setFormData(prev => ({ ...prev, nomor_hp: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pin">PIN Absensi (6 Digit) *</Label>
                  <Input
                    id="pin"
                    type="password"
                    value={formData.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="Masukkan 6 digit PIN"
                    maxLength={6}
                    className={errors.pin ? 'border-red-500' : ''}
                  />
                  {errors.pin && <p className="text-xs text-red-500">{errors.pin}</p>}
                  <p className="text-xs text-slate-500">Untuk absensi manual</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="expired_date">Masa Berlaku Kartu</Label>
                  <Input
                    id="expired_date"
                    type="date"
                    value={formData.expired_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expired_date: e.target.value }))}
                    className="bg-slate-50 border-slate-200"
                  />
                  <p className="text-xs text-slate-500">Kosongkan untuk menggunakan default (3 tahun dari sekarang)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Foto Profile */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <CardTitle>Foto Profile</CardTitle>
              </div>
              <CardDescription>Upload foto siswa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Avatar className="w-32 h-32 border-4 border-slate-200">
                  <AvatarImage src={formData.foto_profile} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-4xl">
                    {formData.nama_lengkap.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex justify-center gap-2">
                <Button
                  variant={photoMethod === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPhotoMethod('upload')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={photoMethod === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPhotoMethod('url')}
                >
                  <Link className="w-4 h-4 mr-2" />
                  URL
                </Button>
              </div>

              {photoMethod === 'upload' && (
                <div className="flex flex-col items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Pilih File
                  </Button>
                  <p className="text-xs text-slate-500">Format: JPG, PNG. Maks: 2MB</p>
                </div>
              )}

              {photoMethod === 'url' && (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/foto.jpg"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                  />
                  <Button onClick={handleUrlPhoto}>Load</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Face ID */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ScanFace className="w-5 h-5 text-blue-600" />
                <CardTitle>Daftarkan Face ID</CardTitle>
              </div>
              <CardDescription>Capture wajah siswa untuk absensi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Loading Status */}
              {!faceModelsLoaded && (
                <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Memuat Model AI</p>
                    <p className="text-sm text-blue-600">Harap tunggu, model Face ID sedang dimuat...</p>
                  </div>
                </div>
              )}

              {/* Model Error */}
              {faceModelsError && (
                <div className="bg-red-50 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Error Memuat Model</p>
                    <p className="text-sm text-red-600">{faceModelsError}</p>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {faceModelsLoaded && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="font-medium text-blue-800 mb-2">Petunjuk Pendaftaran Face ID:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Pastikan pencahayaan cukup terang</li>
                    <li>• Posisikan wajah di tengah frame</li>
                    <li>• Lepaskan kacamata gelap atau penutup wajah</li>
                    <li>• Ambil 3 foto wajah dengan sedikit variasi posisi</li>
                  </ul>
                </div>
              )}

              {/* Sample Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Progress Sample</span>
                  <span className="text-sm text-slate-500">{faceSamples.length}/3</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
                        faceSamples.length >= i
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-slate-100 border-slate-300 text-slate-400'
                      }`}
                    >
                      {faceSamples.length >= i ? (
                        <CheckCircle className="w-8 h-8" />
                      ) : (
                        <span className="text-xl font-medium">{i}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Camera View */}
              <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
                {/* Always render video element but hide when not active */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ 
                    transform: 'scaleX(-1)',
                    display: cameraActive ? 'block' : 'none'
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ 
                    transform: 'scaleX(-1)',
                    display: cameraActive ? 'block' : 'none'
                  }}
                />
                
                {cameraActive && (
                  <>
                    <div className="absolute top-4 left-4 flex gap-2">
                      <Badge className={faceDetected ? 'bg-green-500' : 'bg-red-500'}>
                        {faceDetected ? '✓ Wajah Terdeteksi' : '✗ Wajah Tidak Terdeteksi'}
                      </Badge>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-black/50 rounded-lg p-2 text-center">
                        <p className="text-white text-sm">
                          {faceDetected 
                            ? 'Klik "Capture" untuk mengambil foto wajah' 
                            : 'Posisikan wajah Anda di dalam frame'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Camera className="w-16 h-16 mb-4" />
                    <p className="text-lg">Kamera tidak aktif</p>
                    <p className="text-sm mt-1">Klik tombol di bawah untuk mengaktifkan kamera</p>
                  </div>
                )}
              </div>

              {/* Camera Error */}
              {cameraError && (
                <div className="bg-red-50 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600">{cameraError}</p>
                </div>
              )}

              {/* Camera Controls */}
              {faceModelsLoaded && (
                <div className="flex flex-wrap justify-center gap-3">
                  {!cameraActive ? (
                    <Button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700">
                      <Camera className="w-4 h-4 mr-2" />
                      Aktifkan Kamera
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={stopCamera}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Matikan Kamera
                      </Button>
                      <Button
                        onClick={captureFaceDescriptor}
                        disabled={!faceDetected || capturingFace || faceSamples.length >= 3}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        {capturingFace ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Capture ({faceSamples.length}/3)
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  
                  {faceSamples.length > 0 && faceSamples.length < 3 && (
                    <Button variant="ghost" onClick={resetFaceSamples} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      Reset Sample
                    </Button>
                  )}
                </div>
              )}

              {/* Success Message */}
              {faceSamples.length >= 3 && (
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Pendaftaran Face ID Selesai!</p>
                    <p className="text-sm text-green-600">3 sample wajah berhasil diambil. Anda dapat menyimpan data siswa.</p>
                  </div>
                </div>
              )}

              {errors.face && (
                <p className="text-center text-red-500 text-sm">{errors.face}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>

          {currentStep < 3 ? (
            <Button onClick={nextStep} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              Lanjut
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving || faceSamples.length < 3}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Data
            </Button>
          )}
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
              Data siswa berhasil {isEditMode ? 'diperbarui' : 'ditambahkan'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push('/')}>
              Kembali ke Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
