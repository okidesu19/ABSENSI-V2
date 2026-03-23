'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  Calendar,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  MapPin,
  Navigation,
  History,
  MessageSquare,
  Printer
} from 'lucide-react';

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  jurusan: string;      // e.g., "TJKT 1"
  kelas: string;        // e.g., "X", "XI", "XII"
}

// New class structure
interface ClassData {
  id: string;
  nama_jurusan: string;
  singkatan: string;
  label: Record<string, { kelas: string[] }>;
  created_at: number;
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

interface ClassAttendanceStatus {
  classId: string;
  jurisdiction: string; // Full jurisdiction name
  jurisdictionCode: string; // Short code like TJKT, AKL
  kelas: string; // Just the class level like X, XI, XII
  total: number;
  hadir: number;
  percentage: number;
  status: 'high' | 'medium' | 'low';
}

// Parse labels from class data for display
interface ParsedLabel {
  jurusanCode: string;     // e.g., "TJKT 1"
  namaJurusan: string;     // e.g., "Teknik Jaringan Komputer & Telekomunikasi"
  singkatan: string;       // e.g., "TJKT"
  labelNum: number;        // e.g., 1
  kelas: string[];         // e.g., ["X", "XI", "XII"]
}

export default function DashboardTab() {
  const [totalStudents, setTotalStudents] = useState(0);
  const [hadirHariIni, setHadirHariIni] = useState(0);
  const [belumHadir, setBelumHadir] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [classStatuses, setClassStatuses] = useState<ClassAttendanceStatus[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<Array<{
    id: string;
    studentName: string;
    time: string;
    method: 'face' | 'manual';
    status: 'hadir' | 'terlambat' | 'alpha';
    latitude?: number;
    longitude?: number;
    nis?: string;
    kelas?: string;
    jurisdiction?: string;
  }>>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<typeof recentAttendance[0] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}`;

    // Fetch students
    const studentsRef = ref(database, 'students');
    const unsubscribeStudents = onValue(studentsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const studentsData = snapshot.val() as Record<string, Student>;
        const students = Object.values(studentsData);
        setTotalStudents(students.length);

        // Fetch classes
        const classesRef = ref(database, 'classes');
        const classesSnapshot = await get(classesRef);
        const classesData: ClassData[] = [];
        if (classesSnapshot.exists()) {
          Object.entries(classesSnapshot.val()).forEach(([id, data]) => {
            classesData.push({ id, ...(data as Omit<ClassData, 'id'>) });
          });
        }

        // Parse labels from classes for status display
        const parsedLabels: ParsedLabel[] = classesData.flatMap(cls => {
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

        // Fetch today's attendance
        const attendanceRef = ref(database, `attendance/${dateKey}`);
        const attendanceSnapshot = await get(attendanceRef);
        
        let hadir = 0;
        const classAttendanceMap: Record<string, number> = {};
        
        if (attendanceSnapshot.exists()) {
          const attendanceData = attendanceSnapshot.val() as Record<string, AttendanceRecord>;
          const attendanceRecords = Object.entries(attendanceData);
          hadir = attendanceRecords.length;
          
          // Process recent attendance
          const recent = attendanceRecords
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .slice(0, 10)
            .map(([studentId, record]) => {
              const student = studentsData[studentId];
              return {
                id: studentId,
                studentName: student?.nama_lengkap || 'Unknown',
                time: new Date(record.timestamp).toLocaleTimeString('id-ID'),
                method: record.method,
                status: record.status,
                latitude: record.latitude,
                longitude: record.longitude,
                nis: student?.nis,
                kelas: student?.kelas,
                jurisdiction: student?.jurusan
              };
            });
          setRecentAttendance(recent);

          // Count attendance per class (jurusan + kelas)
          attendanceRecords.forEach(([studentId, record]) => {
            const student = studentsData[studentId];
            if (student) {
              const classKey = `${student.jurusan}-${student.kelas}`;
              classAttendanceMap[classKey] = (classAttendanceMap[classKey] || 0) + 1;
            }
          });
        } else {
          setRecentAttendance([]);
        }

        setHadirHariIni(hadir);
        setBelumHadir(students.length - hadir);
        setPercentage(students.length > 0 ? Math.round((hadir / students.length) * 100) : 0);

        // Calculate class statuses based on parsed labels
        const classStatusList: ClassAttendanceStatus[] = [];
        parsedLabels.forEach((label) => {
          // For each kelas in the label
          label.kelas.forEach((kelas) => {
            const classKey = `${label.jurusanCode}-${kelas}`;
            const classStudents = students.filter(s => s.jurusan === label.jurusanCode && s.kelas === kelas);
            const classHadir = classAttendanceMap[classKey] || 0;
            const classTotal = classStudents.length;
            const classPercent = classTotal > 0 ? Math.round((classHadir / classTotal) * 100) : 0;
            
            classStatusList.push({
              classId: `${label.jurusanCode}-${kelas}`,
              jurisdiction: label.namaJurusan,
              jurisdictionCode: label.jurusanCode,
              kelas: kelas,
              total: classTotal,
              hadir: classHadir,
              percentage: classPercent,
              status: classPercent >= 80 ? 'high' : classPercent >= 50 ? 'medium' : 'low'
            });
          });
        });

        // Sort by jurisdiction first, then by kelas
        classStatusList.sort((a, b) => {
          const jurisdictionCompare = a.jurisdictionCode.localeCompare(b.jurisdictionCode);
          if (jurisdictionCompare !== 0) return jurisdictionCompare;
          // Sort kelas: X, XI, XII
          const kelasOrder: Record<string, number> = { 'X': 1, 'XI': 2, 'XII': 3 };
          return (kelasOrder[a.kelas] || 4) - (kelasOrder[b.kelas] || 4);
        });
        setClassStatuses(classStatusList);
        setLoading(false);
      } else {
        setTotalStudents(0);
        setHadirHariIni(0);
        setBelumHadir(0);
        setPercentage(0);
        setClassStatuses([]);
        setRecentAttendance([]);
        setLoading(false);
      }
    });

    return () => unsubscribeStudents();
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('id-ID', options);
  };

  const statsCards = [
    {
      title: 'Total Siswa',
      value: totalStudents,
      icon: Users,
      color: 'blue',
      trend: '',
      gradient: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
      shadowColor: 'shadow-blue-500/20'
    },
    {
      title: 'Hadir Hari Ini',
      value: hadirHariIni,
      icon: CheckCircle,
      color: 'green',
      trend: 'Real-time update',
      gradient: 'from-green-500 to-emerald-600',
      bgLight: 'bg-green-50',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
      shadowColor: 'shadow-green-500/20'
    },
    {
      title: 'Belum Hadir',
      value: belumHadir,
      icon: XCircle,
      color: 'red',
      trend: '',
      gradient: 'from-red-500 to-rose-600',
      bgLight: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
      shadowColor: 'shadow-red-500/20',
      alert: belumHadir > 0
    },
    {
      title: 'Persentase Kehadiran',
      value: `${percentage}%`,
      icon: TrendingUp,
      color: 'purple',
      trend: '',
      gradient: 'from-purple-500 to-violet-600',
      bgLight: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700',
      shadowColor: 'shadow-purple-500/20',
      showProgress: true,
      progressValue: percentage
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Absensi</h1>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(currentTime)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-600 bg-white px-4 py-2 rounded-lg shadow-sm">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-lg">{currentTime.toLocaleTimeString('id-ID')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index}
              className={`group relative overflow-hidden rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-300 card-hover animate-fade-in`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Gradient accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <p className={`text-3xl font-bold mt-2 ${stat.valueColor} transition-all duration-300 group-hover:scale-105`}>
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        {stat.trend}
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${stat.iconBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                </div>
                {stat.showProgress && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Progress</span>
                      <span>{stat.progressValue}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${stat.gradient} rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${stat.progressValue}%` }}
                      />
                    </div>
                  </div>
                )}
                {stat.alert && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    Perlu perhatian!
                  </div>
                )}
              </CardContent>
            </div>
          );
        })}
      </div>

      {/* Class Status Table */}
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <GraduationCap className="w-5 h-5 text-blue-600" />
              </div>
              Status Absensi per Kelas
            </CardTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {classStatuses.length} Kelas
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : classStatuses.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Belum ada data kelas</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold text-slate-700">Jurusan</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Kelas</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Total</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Hadir</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Persentase</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStatuses.map((cls, index) => {
                    // Check if this is the first row for this jurisdiction
                    const prevCls = index > 0 ? classStatuses[index - 1] : null;
                    const isFirstInGroup = !prevCls || prevCls.jurisdictionCode !== cls.jurisdictionCode;
                    
                    return (
                    <TableRow 
                      key={`class-status-${cls.classId}-${index}`}
                      className={`hover:shadow-md transition-all duration-200 ${
                        cls.status === 'high' ? 'bg-green-50 hover:bg-green-100' :
                        cls.status === 'medium' ? 'bg-yellow-50 hover:bg-yellow-100' :
                        'bg-red-50 hover:bg-red-100'
                      }`}
                    >
                      <TableCell className="font-medium">
                        {isFirstInGroup ? (
                          <span className="font-bold">{cls.jurisdictionCode}</span>
                        ) : (
                          <span className="text-transparent">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{cls.kelas}</TableCell>
                      <TableCell className="text-center">{cls.total}</TableCell>
                      <TableCell className="text-center">{cls.hadir}</TableCell>
                      <TableCell className="text-center">{cls.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            cls.status === 'high' ? 'border-green-500 text-green-700 bg-green-100' :
                            cls.status === 'medium' ? 'border-yellow-500 text-yellow-700 bg-yellow-100' :
                            'border-red-500 text-red-700 bg-red-100'
                          }
                        >
                          {cls.status === 'high' ? 'Baik' : cls.status === 'medium' ? 'Sedang' : 'Rendah'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              Notifikasi Siswa Terbaru
            </CardTitle>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {recentAttendance.length} absensi
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentAttendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">Belum ada absensi hari ini</p>
              <p className="text-sm text-slate-400 mt-1">Data akan muncul saat siswa melakukan absensi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
              {recentAttendance.map((item, index) => (
                <button
                  key={`recent-${item.id}-${index}`}
                  onClick={() => setSelectedAttendance(item)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors duration-200 animate-fade-in text-left"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                      {item.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{item.studentName}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.time}
                      </p>
                      {item.latitude && item.longitude && (
                        <p className="text-xs text-blue-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          Lokasi terverifikasi
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        item.status === 'hadir' 
                          ? 'border-green-500 text-green-700 bg-green-50 font-medium' 
                          : 'border-yellow-500 text-yellow-700 bg-yellow-50 font-medium'
                      }
                    >
                      {item.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.method === 'face'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                          : 'bg-orange-100 text-orange-800 border-orange-300 font-medium'
                      }
                    >
                      {item.method === 'face' ? 'Face ID' : 'PIN'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedAttendance} onOpenChange={() => setSelectedAttendance(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Detail Absensi Siswa</DialogTitle>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md">
                  {selectedAttendance.studentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedAttendance.studentName}</h3>
                  <p className="text-sm text-slate-500">{selectedAttendance.jurisdiction} - {selectedAttendance.kelas}</p>
                  <p className="text-sm text-slate-500">NIS: {selectedAttendance.nis}</p>
                </div>
              </div>

              {/* Attendance Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Waktu Absen</p>
                  <p className="font-medium text-slate-800">{selectedAttendance.time}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge className={selectedAttendance.status === 'hadir' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {selectedAttendance.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Metode</p>
                  <Badge className={selectedAttendance.method === 'face' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                    {selectedAttendance.method === 'face' ? 'Face ID' : 'PIN'}
                  </Badge>
                </div>
              </div>

              {/* Location */}
              {selectedAttendance.latitude && selectedAttendance.longitude ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Lokasi Absensi</p>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span>Koordinat: {selectedAttendance.latitude.toFixed(6)}, {selectedAttendance.longitude.toFixed(6)}</span>
                    </div>
                    {/* Simple map placeholder - in production use Leaflet or Google Maps */}
                    <div className="h-40 bg-slate-200 rounded-lg flex items-center justify-center">
                      <a 
                        href={`https://www.google.com/maps?q=${selectedAttendance.latitude},${selectedAttendance.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <Navigation className="w-4 h-4" />
                        Buka di Google Maps
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Lokasi tidak tersedia
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <History className="w-4 h-4 mr-2" />
                  Lihat Riwayat Absensi
                </Button>
                <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-100">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Kirim Pesan ke Orang Tua
                </Button>
                <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-100">
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak Bukti Absensi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
