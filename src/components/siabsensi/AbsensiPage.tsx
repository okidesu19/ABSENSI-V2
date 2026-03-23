'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { 
  QrCode, Camera, CheckCircle, XCircle, Clock, 
  RefreshCw, User, ScanFace, ArrowLeft,
  Sparkles, Shield, Fingerprint, AlertTriangle,
  CreditCard, Keyboard, MapPin, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import * as faceapi from 'face-api.js';

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  jurusan: string;
  kelas: string;
  pin: string;
  face_descriptors?: number[][];
  foto_profile?: string;
  expired_date?: string;
}

interface Settings {
  jam_masuk: string;
  jam_terlambat: string;
  hari_aktif: string[];
}

interface AttendanceRecord {
  status: 'hadir' | 'terlambat' | 'alpha';
  method: 'face' | 'manual';
  timestamp: number;
  student_id: string;
  class_id: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type AttendanceStep = 'method_select' | 'scan_qr' | 'nis_input' | 'confirm' | 'already' | 'method' | 'face' | 'face_verify_result' | 'pin' | 'result';

export default function AbsensiPage() {
  const [step, setStep] = useState<AttendanceStep>('method_select');
  const [student, setStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceRecord | null>(null);
  const [settings, setSettings] = useState<Settings>({
    jam_masuk: '07:00',
    jam_terlambat: '07:30',
    hari_aktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nisInput, setNisInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Face recognition state
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [faceCentered, setFaceCentered] = useState(false);
  const [currentFaceDescriptor, setCurrentFaceDescriptor] = useState<Float32Array | null>(null);
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attendance result
  const [attendanceResult, setAttendanceResult] = useState<{
    status: 'hadir' | 'terlambat' | 'alpha';
    timestamp: Date;
  } | null>(null);

  // Location state
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Get current GPS location
  const getCurrentLocation = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser'));
        return;
      }

      setLocationLoading(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setCurrentLocation(locationData);
          setLocationLoading(false);
          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Gagal mendapatkan lokasi';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Izin lokasi ditolak';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Lokasi tidak tersedia';
              break;
            case error.TIMEOUT:
              errorMessage = 'Waktu permintaan lokasi habis';
              break;
          }
          setLocationError(errorMessage);
          setLocationLoading(false);
          // Resolve with null coordinates if location fails - attendance can still proceed
          resolve({ latitude: 0, longitude: 0, accuracy: 0 });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load settings
  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    get(settingsRef).then((snapshot) => {
      if (snapshot.exists()) {
        setSettings(prev => ({ ...prev, ...snapshot.val() }));
      }
    });
  }, []);

  // Initialize QR Scanner
  useEffect(() => {
    if (step !== 'scan_qr') return;

    qrScannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );

    qrScannerRef.current.render(
      async (decodedText) => {
        try {
          await fetchStudent(decodedText);
        } catch (error) {
          toast.error('QR Code tidak valid');
        }
      },
      (error) => {
        // Ignore scan errors
      }
    );

    return () => {
      qrScannerRef.current?.clear().catch(() => {});
    };
  }, [step]);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
          faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
          faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/')
        ]);
        setFaceModelsLoaded(true);
      } catch (error) {
        console.error('Error loading face models:', error);
      }
    };
    loadModels();
  }, []);

  // Start camera for face recognition
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Tidak dapat mengakses kamera');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
      setFaceCentered(false);
    }
  }, []);

  // Face detection loop - simplified without locking
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || !faceModelsLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const detectFace = async () => {
      if (video.paused || video.ended) return;

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      if (detection) {
        const resizedDetection = faceapi.resizeResults(detection, displaySize);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Check if face is centered
          const box = detection.detection.box;
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const videoCenterX = video.videoWidth / 2;
          const videoCenterY = video.videoHeight / 2;
          const tolerance = 80;
          
          const isCentered = 
            Math.abs(centerX - videoCenterX) < tolerance &&
            Math.abs(centerY - videoCenterY) < tolerance;
          
          setFaceCentered(isCentered);
          setFaceDetected(true);
          
          // Store the face descriptor when detected
          setCurrentFaceDescriptor(detection.descriptor);
          
          // Draw face box
          ctx.strokeStyle = isCentered ? '#22c55e' : '#3b82f6';
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          // Draw label
          ctx.fillStyle = isCentered ? '#22c55e' : '#3b82f6';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(isCentered ? 'Wajah Terdeteksi' : 'Posisikan di tengah', box.x, box.y - 8);
          
          // Draw landmark points
          const landmarks = detection.landmarks;
          const landmarkColor = isCentered ? '#22c55e' : '#3b82f6';
          
          landmarks.positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = landmarkColor;
            ctx.fill();
          });
        }
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFaceDetected(false);
        setFaceCentered(false);
        setCurrentFaceDescriptor(null);
      }
    };

    const interval = setInterval(detectFace, 150);
    return () => {
      clearInterval(interval);
    };
  }, [cameraActive, faceModelsLoaded]);

  // Check if card is expired
  const isCardExpired = (expiredDate?: string): boolean => {
    if (!expiredDate) return false;
    return new Date() > new Date(expiredDate);
  };

  // Fetch student data with duplicate check
  const fetchStudent = async (identifier: string) => {
    setLoading(true);
    try {
      const studentsRef = ref(database, 'students');
      const snapshot = await get(studentsRef);
      
      if (snapshot.exists()) {
        const students = snapshot.val() as Record<string, Student>;
        const foundEntry = Object.entries(students).find(
          ([id, s]) => s.nis === identifier || id === identifier
        );
        
        if (foundEntry) {
          const [id, data] = foundEntry;
          const studentData = { id, ...data };
          
          // Check if card is expired
          if (isCardExpired(studentData.expired_date)) {
            toast.error('Kartu pelajar sudah expired');
            setLoading(false);
            return;
          }
          
          // Check for existing attendance today
          const now = new Date();
          const dateKey = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
          
          const attendanceRef = ref(database, `attendance/${dateKey}/${id}`);
          const attendanceSnapshot = await get(attendanceRef);
          
          if (attendanceSnapshot.exists()) {
            const attendanceData = attendanceSnapshot.val() as AttendanceRecord;
            setStudent(studentData);
            setExistingAttendance(attendanceData);
            setStep('already');
          } else {
            setStudent(studentData);
            setExistingAttendance(null);
            setStep('confirm');
          }
        } else {
          toast.error('Siswa tidak ditemukan');
        }
      } else {
        toast.error('Data siswa tidak tersedia');
      }
    } catch (error) {
      console.error('Error fetching student:', error);
      toast.error('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  // Handle NIS input
  const handleNisSubmit = () => {
    if (nisInput.length >= 4) {
      fetchStudent(nisInput);
    }
  };

  // Confirm identity
  const confirmIdentity = (confirmed: boolean) => {
    if (confirmed) {
      setStep('method');
    } else {
      resetScanner();
    }
  };

  // Select method
  const selectMethod = async (method: 'face' | 'pin') => {
    // Try to get location when user selects a method
    if (!currentLocation || currentLocation.latitude === 0) {
      try {
        await getCurrentLocation();
      } catch (e) {
        console.log('Could not get location:', e);
      }
    }
    
    if (method === 'face') {
      setStep('face');
      // Load all students for face matching
      try {
        const studentsRef = ref(database, 'students');
        const snapshot = await get(studentsRef);
        if (snapshot.exists()) {
          const students = snapshot.val() as Record<string, Student>;
          const studentsList = Object.entries(students).map(([id, data]) => ({
            id,
            ...data
          })).filter(s => s.face_descriptors && s.face_descriptors.length > 0);
          setAllStudents(studentsList);
        }
      } catch (error) {
        console.error('Error loading students for face matching:', error);
      }
      startCamera();
    } else {
      setStep('pin');
    }
  };

  // Handle Face In verification - verify face against all students in database
  const handleFaceIn = async () => {
    if (!currentFaceDescriptor || !allStudents.length) {
      toast.error('Wajah tidak terdeteksi atau data siswa belum dimuat');
      return;
    }

    setVerifying(true);
    try {
      // Compare face against the CONFIRMED student only (not all students)
      // This ensures if Jonatan confirms his identity, only his face is verified
      let identifiedStudent: Student | null = null;
      let bestMatchDistance = Infinity;
      
      // Use the confirmed student from previous step
      const studentToVerify = student;
      
      if (!studentToVerify) {
        toast.error('Silakan konfirmasi identitas terlebih dahulu');
        return;
      }
      
      if (!studentToVerify.face_descriptors || studentToVerify.face_descriptors.length === 0) {
        toast.error('Data wajah tidak ditemukan untuk siswa ini');
        return;
      }
      
      // Only compare against the confirmed student's face descriptors
      for (const storedDescriptor of studentToVerify.face_descriptors) {
        const distance = faceapi.euclideanDistance(
          currentFaceDescriptor,
          new Float32Array(storedDescriptor)
        );
        
        if (distance < bestMatchDistance) {
          bestMatchDistance = distance;
          identifiedStudent = studentToVerify;
        }
      }
      
      // Threshold for face matching (lower = more strict)
      const MATCH_THRESHOLD = 0.6;
      
      if (bestMatchDistance >= MATCH_THRESHOLD) {
        // Face doesn't match the confirmed student
        toast.error(`Wajah tidak cocok dengan ${studentToVerify.nama_lengkap}. Apakah Anda orang lain?`);
        setVerifiedStudent(null);
        return;
      }
      
      if (!identifiedStudent) {
        toast.error('Wajah tidak terdaftar dalam sistem');
        return;
      }
      
      // Check if the identified student's card is not expired
      if (isCardExpired(identifiedStudent.expired_date)) {
        toast.error('Kartu pelajar sudah expired');
        return;
      }
      
      // Check if already attended today
      const now = new Date();
      const dateKey = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
      const attendanceRef = ref(database, `attendance/${dateKey}/${identifiedStudent.id}`);
      const attendanceSnapshot = await get(attendanceRef);
      
      if (attendanceSnapshot.exists()) {
        const attendanceData = attendanceSnapshot.val() as AttendanceRecord;
        toast.error(`Anda sudah absen pada ${new Date(attendanceData.timestamp).toLocaleTimeString('id-ID')}`);
        setVerifiedStudent(null);
        stopCamera();
        setStep('method_select');
        return;
      }
      
      // Verification successful - show student data
      setVerifiedStudent(identifiedStudent);
      setStudent(identifiedStudent);
      toast.success('✓ Verifikasi Berhasil!', {
        description: `Selamat datang, ${identifiedStudent.nama_lengkap}!`,
        duration: 3000
      });
      setStep('face_verify_result');
      
    } catch (error) {
      console.error('Error verifying face:', error);
      toast.error('Terjadi kesalahan saat verifikasi');
    } finally {
      setVerifying(false);
    }
  };

  // Verify PIN
  const verifyPin = async () => {
    if (!student || pinInput.length !== 6) return;

    if (pinInput === student.pin) {
      await saveAttendance('manual');
    } else {
      toast.error('PIN salah');
    }
  };

  // Save attendance with location data
  const saveAttendance = async (method: 'face' | 'manual') => {
    if (!student) return;

    try {
      // Get current location - try to get fresh location or use cached
      let locationData: { latitude: number; longitude: number; accuracy: number; timestamp: number } | null = null;
      
      // First try to use cached location if it's recent (less than 30 seconds old)
      const locationTime = Date.now();
      const isLocationRecent = currentLocation && (locationTime - (currentLocation as any)?.timestamp < 30000);
      
      if (currentLocation && currentLocation.latitude !== 0 && currentLocation.longitude !== 0) {
        // Validate location accuracy - warn if accuracy is poor (> 100m)
        if (currentLocation.accuracy > 100) {
          console.warn('Location accuracy is poor:', currentLocation.accuracy, 'meters');
          toast.warning(`Akurasi lokasi rendah: ${Math.round(currentLocation.accuracy)}m. Sebaiknya coba lagi.`);
        }
        
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          timestamp: locationTime
        };
      } else {
        // Try to get fresh location
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          
          // Validate accuracy
          if (position.coords.accuracy > 100) {
            toast.warning(`Akurasi lokasi rendah: ${Math.round(position.coords.accuracy)}m`);
          }
          
          locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
        } catch (geoError) {
          console.log('Location not available:', geoError);
          toast.error('Tidak dapat mendapatkan lokasi. Absensi tetap disimpan tanpa koordinat.');
        }
      }

      const currentDate = new Date();
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      const [masukHour, masukMinute] = settings.jam_masuk.split(':').map(Number);
      const [terlambatHour, terlambatMinute] = settings.jam_terlambat.split(':').map(Number);

      const currentTimeMinutes = currentHour * 60 + currentMinute;
      const terlambatTimeMinutes = terlambatHour * 60 + terlambatMinute;

      let status: 'hadir' | 'terlambat' = 'hadir';
      if (currentTimeMinutes > terlambatTimeMinutes) {
        status = 'terlambat';
      }

      const dateKey = `${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}_${String(currentDate.getDate()).padStart(2, '0')}`;
      
      const attendanceData: Record<string, unknown> = {
        status,
        method,
        timestamp: currentDate.getTime(),
        student_id: student.id,
        class_id: `${student.jurusan}-${student.kelas}`,
        nis: student.nis,
        nama_lengkap: student.nama_lengkap,
        jurisdiction: student.jurusan,
        kelas: student.kelas,
        // GPS Location data
        latitude: locationData?.latitude || null,
        longitude: locationData?.longitude || null,
        location_accuracy: locationData?.accuracy || null,
        location_timestamp: locationData?.timestamp || null
      };
      
      await set(ref(database, `attendance/${dateKey}/${student.id}`), attendanceData);

      setAttendanceResult({ status, timestamp: currentDate });
      stopCamera();
      setStep('result');
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Terjadi kesalahan saat menyimpan absensi');
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setStudent(null);
    setVerifiedStudent(null);
    setAllStudents([]);
    setCurrentFaceDescriptor(null);
    setExistingAttendance(null);
    setNisInput('');
    setPinInput('');
    setAttendanceResult(null);
    setCurrentLocation(null);
    setLocationError(null);
    stopCamera();
    setStep('method_select');
  };

  // Handle method selection
  const handleMethodSelect = (method: 'scan_qr' | 'nis_input') => {
    setStep(method);
  };

  // Handle back to method selection
  const handleBackToMethodSelect = () => {
    stopCamera();
    setStep('method_select');
  };

  // Auto get location when entering method selection step
  useEffect(() => {
    if (step === 'method' && student) {
      // Auto-get location when entering method selection
      if (!currentLocation || currentLocation.latitude === 0) {
        getCurrentLocation().catch(console.error);
      }
    }
  }, [step, student]);

  // Auto redirect after result
  useEffect(() => {
    if (step === 'result' && attendanceResult) {
      const timer = setTimeout(resetScanner, 5000);
      return () => clearTimeout(timer);
    }
  }, [step, attendanceResult]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <div className="bg-black/30 backdrop-blur-xl sticky top-0 z-10 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg">SIABSENSI</h1>
                <p className="text-xs text-blue-300">Face Recognition Attendance</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-black/30 rounded-xl px-4 py-2 backdrop-blur-sm border border-white/10">
                <p className="font-mono text-xl font-bold text-white" suppressHydrationWarning>{formatTime(currentTime)}</p>
                <p className="text-xs text-slate-400" suppressHydrationWarning>{formatDate(currentTime)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Step: Method Selection */}
        {step === 'method_select' && (
          <div className="space-y-6 animate-fade-in">
            <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 text-center border-b border-white/10">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <QrCode className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Pilih Metode Absensi</h2>
                  <p className="text-slate-300">Silakan pilih metode untuk melakukan absensi</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Scan QR/Card Option */}
                  <button
                    onClick={() => handleMethodSelect('scan_qr')}
                    className="w-full p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-white/10 rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <CreditCard className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-white">Scan Kartu Pelajar</h3>
                        <p className="text-slate-400">Pindai QR Code pada kartu pelajar</p>
                      </div>
                    </div>
                  </button>

                  {/* NIS Input Option */}
                  <button
                    onClick={() => handleMethodSelect('nis_input')}
                    className="w-full p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 border border-white/10 rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Keyboard className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-white">Masukkan NIS</h3>
                        <p className="text-slate-400">Ketik nomor NIS secara manual</p>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Scan QR */}
        {step === 'scan_qr' && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 text-center border-b border-white/10 flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBackToMethodSelect}
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Kembali
                </Button>
                <div>
                  <h2 className="text-xl font-bold text-white">Scan Kartu Pelajar</h2>
                  <p className="text-slate-400 text-sm">Arahkan QR Code ke kamera</p>
                </div>
                <div className="w-20"></div>
              </div>

              <div className="p-6">
                {/* QR Scanner */}
                <div id="qr-reader" className="mb-6 rounded-xl overflow-hidden"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: NIS Input */}
        {step === 'nis_input' && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 p-6 text-center border-b border-white/10 flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBackToMethodSelect}
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Kembali
                </Button>
                <div>
                  <h2 className="text-xl font-bold text-white">Masukkan NIS</h2>
                  <p className="text-slate-400 text-sm">Ketik nomor NIS Anda</p>
                </div>
                <div className="w-20"></div>
              </div>

              <div className="p-6 space-y-4">
                {/* NIS Input */}
                <div className="space-y-3">
                  <Input
                    value={nisInput}
                    onChange={(e) => setNisInput(e.target.value)}
                    placeholder="Masukkan NIS"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-green-500 text-center text-xl py-6"
                    onKeyDown={(e) => e.key === 'Enter' && handleNisSubmit()}
                  />
                  <Button 
                    onClick={handleNisSubmit} 
                    disabled={loading || nisInput.length < 4}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 text-lg"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Keyboard className="w-5 h-5 mr-2" />}
                    {loading ? 'Mencari...' : 'Cari Siswa'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirm Identity (Modal Style) */}
        {step === 'confirm' && student && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <Card className="overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-xl max-w-md w-full animate-scale-in">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center">
                  <div className="w-24 h-24 bg-white rounded-2xl mx-auto mb-4 overflow-hidden shadow-lg">
                    {student.foto_profile ? (
                      <img src={student.foto_profile} alt={student.nama_lengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                        <span className="text-4xl font-bold text-white">{student.nama_lengkap.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white">{student.nama_lengkap}</h2>
                  <p className="text-blue-100 mt-1">{student.jurusan} {student.kelas}</p>
                  <p className="text-sm text-blue-200 mt-1">NIS: {student.nis}</p>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-blue-800 font-medium">Apakah ini Anda?</p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                      onClick={() => confirmIdentity(false)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Batal
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      onClick={() => confirmIdentity(true)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Ya, Benar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Already Attended */}
        {step === 'already' && student && existingAttendance && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-amber-600/30 to-orange-600/30 p-8 text-center">
                <div className="w-20 h-20 bg-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-amber-300" />
                </div>
                <h2 className="text-2xl font-bold text-white">Sudah Absen</h2>
                <p className="text-amber-200 mt-1">{student.nama_lengkap}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm text-amber-200">Anda sudah absen pada:</p>
                      <p className="text-lg font-bold text-amber-300">
                        {new Date(existingAttendance.timestamp).toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Status</p>
                    <Badge className={`mt-1 ${existingAttendance.status === 'hadir' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                      {existingAttendance.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                    </Badge>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Metode</p>
                    <Badge variant="outline" className="mt-1 border-white/20 text-white">
                      {existingAttendance.method === 'face' ? 'Face ID' : 'PIN'}
                    </Badge>
                  </div>
                </div>

                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10" onClick={resetScanner}>
                  Kembali ke Scanner
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Select Method */}
        {step === 'method' && student && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="p-6 text-center border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Pilih Metode Absensi</h2>
                <p className="text-sm text-slate-400 mt-1">{student.nama_lengkap}</p>
              </div>

              {/* Location Status */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-5 h-5 ${currentLocation ? 'text-green-400' : 'text-slate-400'}`} />
                    <span className="text-sm text-slate-300">Lokasi GPS</span>
                  </div>
                  {locationLoading ? (
                    <div className="flex items-center gap-2 text-blue-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Mendapatkan lokasi...</span>
                    </div>
                  ) : currentLocation ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400">
                        ✓ Akurasi: {Math.round(currentLocation.accuracy)}m
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => getCurrentLocation()}
                        className="h-6 text-xs text-slate-400 hover:text-white"
                      >
                        Refresh
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => getCurrentLocation()}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      Dapatkan Lokasi
                    </Button>
                  )}
                </div>
                {locationError && (
                  <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-400">
                    {locationError}
                  </div>
                )}
              </div>

              <div className="p-4 grid grid-cols-2 gap-4">
                <button
                  onClick={() => selectMethod('face')}
                  className="p-6 rounded-2xl border-2 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Fingerprint className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-semibold text-white">Face ID</p>
                  <p className="text-sm text-slate-400 mt-1">Scan wajah</p>
                </button>

                <button
                  onClick={() => selectMethod('pin')}
                  className="p-6 rounded-2xl border-2 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-semibold text-white">PIN Manual</p>
                  <p className="text-sm text-slate-400 mt-1">6 digit PIN</p>
                </button>
              </div>

              <div className="p-4 pt-0">
                <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={resetScanner}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Face Recognition */}
        {step === 'face' && student && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="p-4 text-center border-b border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                  <Fingerprint className="w-5 h-5 text-blue-400" />
                  Verifikasi Wajah
                </h2>
                <p className="text-slate-400 text-sm">Tunggu wajah terdeteksi, lalu tekan Face In</p>
              </div>

              {/* Camera View */}
              <div className="relative aspect-video bg-slate-900 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {/* Face Detection Indicator */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className={`${faceDetected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {faceDetected ? '✓ Wajah Terdeteksi' : 'Mendeteksi...'}
                  </Badge>
                </div>

                {/* Center Guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-48 border-2 rounded-2xl transition-colors ${faceCentered ? 'border-green-500' : 'border-white/30'}`} />
                </div>
              </div>

              <div className="p-4 space-y-3">
                <Button
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  onClick={handleFaceIn}
                  disabled={!faceDetected || verifying}
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      <ScanFace className="w-4 h-4 mr-2" />
                      Face In
                    </>
                  )}
                </Button>

                <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => { stopCamera(); setStep('method'); }}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Face Verify Result - Show verified student data */}
        {step === 'face_verify_result' && verifiedStudent && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 p-8 text-center border-b border-white/10">
                <div className="w-20 h-20 bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-300" />
                </div>
                <h2 className="text-2xl font-bold text-white">Verifikasi Berhasil</h2>
                <p className="text-green-200 mt-1">Wajah telah terverifikasi</p>
              </div>

              {/* Student Data Display */}
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-24 h-24 bg-slate-700 rounded-2xl overflow-hidden shadow-lg">
                    {verifiedStudent.foto_profile ? (
                      <img src={verifiedStudent.foto_profile} alt={verifiedStudent.nama_lengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                        <span className="text-3xl font-bold text-white">{verifiedStudent.nama_lengkap.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{verifiedStudent.nama_lengkap}</h3>
                    <p className="text-slate-300">{verifiedStudent.jurusan} {verifiedStudent.kelas}</p>
                    <p className="text-sm text-slate-400">NIS: {verifiedStudent.nis}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Jurusan</p>
                    <p className="text-white font-medium">{verifiedStudent.jurusan}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Kelas</p>
                    <p className="text-white font-medium">{verifiedStudent.kelas}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                    onClick={() => {
                      setVerifiedStudent(null);
                      setStep('face');
                      setCurrentFaceDescriptor(null);
                      startCamera();
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Coba Lagi
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    onClick={async () => {
                      await saveAttendance('face');
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Simpan Absensi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: PIN Input */}
        {step === 'pin' && student && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-8 text-center border-b border-white/10">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Masukkan PIN</h2>
                <p className="text-slate-400 text-sm mt-1">Ketik 6 digit PIN Anda</p>
              </div>

              <div className="p-6">
                {/* PIN Display */}
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                        pinInput.length >= i 
                          ? 'bg-purple-500/30 border-purple-500/50 text-white' 
                          : 'bg-white/5 border-white/10 text-slate-600'
                      } border-2`}
                    >
                      {pinInput.length >= i ? '•' : ''}
                    </div>
                  ))}
                </div>

                {/* PIN Pad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((key, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (key === 'del') {
                          setPinInput(prev => prev.slice(0, -1));
                        } else if (key !== '' && pinInput.length < 6) {
                          setPinInput(prev => prev + key);
                        }
                      }}
                      disabled={key === ''}
                      className={`h-14 rounded-xl font-bold text-xl transition-all ${
                        key === '' ? 'opacity-0' :
                        key === 'del' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' :
                        'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {key === 'del' ? '⌫' : key}
                    </button>
                  ))}
                </div>

                <Button
                  className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  onClick={verifyPin}
                  disabled={pinInput.length !== 6}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Konfirmasi PIN
                </Button>

                <Button variant="ghost" className="w-full mt-2 text-slate-400 hover:text-white" onClick={() => setStep('method')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Result */}
        {step === 'result' && attendanceResult && (
          <Card className="overflow-hidden border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className={`p-8 text-center ${attendanceResult.status === 'hadir' ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30' : 'bg-gradient-to-r from-amber-600/30 to-orange-600/30'}`}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: attendanceResult.status === 'hadir' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)' }}>
                  {attendanceResult.status === 'hadir' ? (
                    <CheckCircle className="w-12 h-12 text-green-300" />
                  ) : (
                    <Clock className="w-12 h-12 text-amber-300" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {attendanceResult.status === 'hadir' ? 'Hadir Tepat Waktu!' : 'Anda Terlambat'}
                </h2>
                <p className="text-slate-300">{student?.nama_lengkap}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-sm">Waktu Absensi</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {formatTime(attendanceResult.timestamp)}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-slate-400">Status</span>
                  <Badge className={attendanceResult.status === 'hadir' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}>
                    {attendanceResult.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                  </Badge>
                </div>

                <p className="text-center text-sm text-slate-400">
                  Halaman akan kembali ke scanner dalam 5 detik...
                </p>

                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10" onClick={resetScanner}>
                  Kembali ke Scanner
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-xl py-4 border-t border-white/10">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-slate-400 text-sm">
            © 2024 SIABSENSI - Sistem Absensi Berbasis Face Recognition
          </p>
        </div>
      </div>
    </div>
  );
}
