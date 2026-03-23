'use client';

import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { 
  Bar, BarChart, Line, LineChart, Pie, PieChart, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Legend 
} from 'recharts'; 
import { 
  Download, Calendar as CalendarIcon, TrendingUp, TrendingDown, RefreshCw,
  FileSpreadsheet, FileText, Users, GraduationCap, Award, Search,
  Filter, Download as DownloadIcon, Printer, ChevronDown, CheckCircle2,
  XCircle, AlertCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, 
  startOfMonth, endOfMonth, eachWeekOfInterval, eachMonthOfInterval,
  parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  jurisdiction: string;
  kelas: string;
  foto_profile?: string;
}

interface ClassData {
  id: string;
  jurisdiction: string;
  label?: string;
}

interface AttendanceRecord {
  status: 'hadir' | 'terlambat' | 'alpha';
  method: 'face' | 'manual';
  timestamp: number;
  student_id: string;
  class_id: string;
  nis?: string;
  nama_lengkap?: string;
  jurisdiction?: string;
  kelas?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
}

interface DailyAttendance {
  date: string;
  dateKey: string;
  hadir: number;
  terlambat: number;
  alpha: number;
  izin: number;
  sakit: number;
  total: number;
  percentage: number;
}

interface StudentAttendance {
  student: Student;
  hadir: number;
  terlambat: number;
  alpha: number;
  izin: number;
  sick: number;
  total: number;
  percentage: number;
  streak: number;
}

interface ClassStats {
  id: string;
  jurisdiction: string;
  kelas: string;
  totalSiswa: number;
  hadir: number;
  terlambat: number;
  alpha: number;
  izin: number;
  sakit: number;
  percentage: number;
}

type ViewType = 'overview' | 'class' | 'student' | 'reports';

const COLORS = {
  hadir: '#10b981',
  terlambat: '#f59e0b',
  alpha: '#ef4444',
  izin: '#8b5cf6',
  sakit: '#3b82f6',
};

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899'];

const chartConfig = {
  hadir: { label: "Hadir", color: COLORS.hadir },
  terlambat: { label: "Terlambat", color: COLORS.terlambat },
  alpha: { label: "Alpha", color: COLORS.alpha },
  izin: { label: "Izin", color: COLORS.izin },
  sakit: { label: "Sakit", color: COLORS.sakit },
} satisfies ChartConfig;

export default function StatistikTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, AttendanceRecord>>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewType>('overview');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [filterJurusan, setFilterJurusan] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendance | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    // Fetch students
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
    });

    // Fetch classes
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

    // Fetch all attendance data
    const attendanceRef = ref(database, 'attendance');
    const unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
      if (snapshot.exists()) {
        setAttendanceData(snapshot.val());
      } else {
        setAttendanceData({});
      }
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeClasses();
      unsubscribeAttendance();
    };
  }, []);

  // Get unique values
  const uniqueJurusan = useMemo(() => {
    return [...new Set(students.map(s => s.jurisdiction).filter(Boolean))];
  }, [students]);

  // Process daily attendance data
  const dailyAttendanceData = useMemo((): DailyAttendance[] => {
    const data: DailyAttendance[] = [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    days.forEach(day => {
      const dateKey = format(day, 'yyyy_MM_dd');
      const dayAttendance = attendanceData[dateKey] || {};
      
      let hadir = 0;
      let terlambat = 0;
      let alpha = 0;
      
      const filteredStudents = students.filter(s => {
        const matchJurusan = filterJurusan === 'all' || s.jurisdiction === filterJurusan;
        const matchKelas = filterKelas === 'all' || s.kelas === filterKelas;
        const matchSearch = searchQuery === '' || s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || s.nis.includes(searchQuery);
        return matchJurusan && matchKelas && matchSearch;
      });

      filteredStudents.forEach(student => {
        const record = dayAttendance[student.id];
        if (record) {
          if (record.status === 'hadir') hadir++;
          else if (record.status === 'terlambat') terlambat++;
          else if (record.status === 'alpha') alpha++;
        } else {
          alpha++;
        }
      });

      const total = hadir + terlambat + alpha;
      data.push({
        date: format(day, 'dd MMM', { locale: id }),
        dateKey,
        hadir,
        terlambat,
        alpha,
        izin: 0,
        sick: 0,
        total: filteredStudents.length,
        percentage: filteredStudents.length > 0 ? Math.round(((hadir + terlambat) / filteredStudents.length) * 100) : 0
      });
    });

    return data;
  }, [attendanceData, students, dateRange, filterJurusan, filterKelas, searchQuery]);

  // Process class statistics
  const classStatistics = useMemo((): ClassStats[] => {
    const stats: ClassStats[] = [];
    const filteredStudents = students.filter(s => {
      const matchJurusan = filterJurusan === 'all' || s.jurisdiction === filterJurusan;
      const matchKelas = filterKelas === 'all' || s.kelas === filterKelas;
      return matchJurusan && matchKelas;
    });

    // Group students by class
    const classGroups = filteredStudents.reduce((acc, student) => {
      const key = `${student.jurisdiction}-${student.kelas}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          jurisdiction: student.jurisdiction,
          kelas: student.kelas,
          totalSiswa: 0,
          hadir: 0,
          terlambat: 0,
          alpha: 0,
          izin: 0,
          sick: 0,
          percentage: 0
        };
      }
      acc[key].totalSiswa++;
      return acc;
    }, {} as Record<string, ClassStats>);

    // Calculate attendance for each class
    Object.entries(classGroups).forEach(([key, classStat]) => {
      const classStudents = filteredStudents.filter(s => `${s.jurisdiction}-${s.kelas}` === key);
      
      classStudents.forEach(student => {
        let foundAttendance = false;
        
        Object.entries(attendanceData).forEach(([dateKey, records]) => {
          const record = records[student.id];
          if (record) {
            foundAttendance = true;
            if (record.status === 'hadir') classStat.hadir++;
            else if (record.status === 'terlambat') classStat.terlambat++;
            else if (record.status === 'alpha') classStat.alpha++;
          }
        });
        
        if (!foundAttendance) {
          classStat.alpha++;
        }
      });

      const total = classStat.hadir + classStat.terlambat + classStat.alpha;
      classStat.percentage = total > 0 ? Math.round(((classStat.hadir + classStat.terlambat) / total) * 100) : 0;
      stats.push(classStat);
    });

    return stats.sort((a, b) => b.percentage - a.percentage);
  }, [students, attendanceData, filterJurusan, filterKelas]);

  // Process individual student statistics
  const studentStatistics = useMemo((): StudentAttendance[] => {
    const stats: StudentAttendance[] = [];
    
    const filteredStudents = students.filter(s => {
      const matchJurusan = filterJurusan === 'all' || s.jurisdiction === filterJurusan;
      const matchKelas = filterKelas === 'all' || s.kelas === filterKelas;
      const matchSearch = searchQuery === '' || s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || s.nis.includes(searchQuery);
      const matchStatus = statusFilter === 'all' || (
        statusFilter === 'good' ? calculateAttendanceRate(s) >= 90 :
        statusFilter === 'warning' ? calculateAttendanceRate(s) >= 70 && calculateAttendanceRate(s) < 90 :
        calculateAttendanceRate(s) < 70
      );
      return matchJurusan && matchKelas && matchSearch && matchStatus;
    });

    filteredStudents.forEach(student => {
      let hadir = 0;
      let terlambat = 0;
      let alpha = 0;
      
      Object.entries(attendanceData).forEach(([dateKey, records]) => {
        const record = records[student.id];
        if (record) {
          if (record.status === 'hadir') hadir++;
          else if (record.status === 'terlambat') terlambat++;
          else if (record.status === 'alpha') alpha++;
        }
      });

      const total = hadir + terlambat + alpha || 1;
      const percentage = Math.round(((hadir + terlambat) / total) * 100);
      
      // Calculate streak
      let streak = 0;
      const sortedDates = Object.keys(attendanceData).sort().reverse();
      for (const dateKey of sortedDates) {
        const record = attendanceData[dateKey][student.id];
        if (record && (record.status === 'hadir' || record.status === 'terlambat')) {
          streak++;
        } else if (record) {
          break;
        }
      }

      stats.push({
        student,
        hadir,
        terlambat,
        alpha,
        izin: 0,
        sick: 0,
        total,
        percentage,
        streak
      });
    });

    return stats.sort((a, b) => b.percentage - a.percentage);
  }, [students, attendanceData, filterJurusan, filterKelas, searchQuery, statusFilter]);

  // Calculate attendance rate helper
  function calculateAttendanceRate(student: Student): number {
    let hadir = 0;
    let total = 0;
    
    Object.entries(attendanceData).forEach(([dateKey, records]) => {
      const record = records[student.id];
      total++;
      if (record && (record.status === 'hadir' || record.status === 'terlambat')) {
        hadir++;
      }
    });
    
    return total > 0 ? (hadir / total) * 100 : 0;
  }

  // Weekly data for charts
  const weeklyTrendData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      let hadir = 0;
      let total = 0;
      
      weekDays.forEach(day => {
        const dateKey = format(day, 'yyyy_MM_dd');
        const dayAttendance = attendanceData[dateKey] || {};
        
        Object.values(dayAttendance).forEach(record => {
          total++;
          if (record.status === 'hadir' || record.status === 'terlambat') {
            hadir++;
          }
        });
      });
      
      return {
        week: `Minggu ${index + 1}`,
        hadir,
        total,
        percentage: total > 0 ? Math.round((hadir / total) * 100) : 0
      };
    });
  }, [attendanceData, dateRange]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      let hadir = 0;
      let terlambat = 0;
      let alpha = 0;
      
      monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy_MM_dd');
        const dayAttendance = attendanceData[dateKey] || {};
        
        Object.values(dayAttendance).forEach(record => {
          if (record.status === 'hadir') hadir++;
          else if (record.status === 'terlambat') terlambat++;
          else if (record.status === 'alpha') alpha++;
        });
      });
      
      return {
        month: format(month, 'MMMM yyyy', { locale: id }),
        hadir,
        terlambat,
        alpha,
        total: hadir + terlambat + alpha,
        percentage: (hadir + terlambat + alpha) > 0 ? Math.round((hadir / (hadir + terlambat + alpha)) * 100) : 0
      };
    });
  }, [attendanceData, dateRange]);

  // Pie chart data
  const statusPieData = useMemo(() => {
    const totalHadir = dailyAttendanceData.reduce((sum, d) => sum + d.hadir, 0);
    const totalTerlambat = dailyAttendanceData.reduce((sum, d) => sum + d.terlambat, 0);
    const totalAlpha = dailyAttendanceData.reduce((sum, d) => sum + d.alpha, 0);
    
    return [
      { name: 'Hadir', value: totalHadir, fill: COLORS.hadir },
      { name: 'Terlambat', value: totalTerlambat, fill: COLORS.terlambat },
      { name: 'Alpha', value: totalAlpha, fill: COLORS.alpha }
    ].filter(d => d.value > 0);
  }, [dailyAttendanceData]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalHadir = dailyAttendanceData.reduce((sum, d) => sum + d.hadir, 0);
    const totalTerlambat = dailyAttendanceData.reduce((sum, d) => sum + d.terlambat, 0);
    const totalAlpha = dailyAttendanceData.reduce((sum, d) => sum + d.alpha, 0);
    const total = totalHadir + totalTerlambat + totalAlpha;
    const avgPercentage = total > 0 ? Math.round(((totalHadir + totalTerlambat) / total) * 100) : 0;
    
    return { totalHadir, totalTerlambat, totalAlpha, total, avgPercentage };
  }, [dailyAttendanceData]);

  // Export to Excel - Professional
  const exportToExcel = async () => {
    const XLSX = (await import('xlsx')).default;
    
    // Summary Sheet
    const summaryData = [{
      'Periode': `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`,
      'Total Hadir': summaryStats.totalHadir,
      'Total Terlambat': summaryStats.totalTerlambat,
      'Total Alpha': summaryStats.totalAlpha,
      'Rata-rata Kehadiran': `${summaryStats.avgPercentage}%`
    }];

    // Student Ranking Sheet
    const studentData = studentStatistics.slice(0, 100).map((s, index) => ({
      'Rank': index + 1,
      'NIS': s.student.nis,
      'Nama': s.student.nama_lengkap,
      'Jurusan': s.student.jurisdiction,
      'Kelas': s.student.kelas,
      'Hadir': s.hadir,
      'Terlambat': s.terlambat,
      'Alpha': s.alpha,
      'Persentase': `${s.percentage}%`,
      'Streak': s.streak
    }));

    // Class Statistics Sheet
    const classData = classStatistics.map(c => ({
      'Jurusan': c.jurisdiction,
      'Kelas': c.kelas,
      'Total Siswa': c.totalSiswa,
      'Hadir': c.hadir,
      'Terlambat': c.terlambat,
      'Alpha': c.alpha,
      'Persentase': `${c.percentage}%`
    }));

    // Daily Report Sheet
    const dailyData = dailyAttendanceData.map(d => ({
      'Tanggal': d.date,
      'Hadir': d.hadir,
      'Terlambat': d.terlambat,
      'Alpha': d.alpha,
      'Total': d.total,
      'Persentase': `${d.percentage}%`
    }));

    const wb = XLSX.utils.book_new();
    
    // Summary Sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
    
    // Student Ranking Sheet
    const wsStudents = XLSX.utils.json_to_sheet(studentData);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Peringkat Siswa');
    
    // Class Statistics Sheet
    const wsClass = XLSX.utils.json_to_sheet(classData);
    XLSX.utils.book_append_sheet(wb, wsClass, 'Statistik Kelas');
    
    // Daily Report Sheet
    const wsDaily = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Laporan Harian');

    // Set column widths
    const colWidths = [
      { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    wsStudents['!cols'] = colWidths;
    wsClass['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    wsDaily['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

    XLSX.writeFile(wb, `laporan-absensi-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('File Excel berhasil diunduh');
  };

  // Export to PDF - Professional
  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFillColor(30, 58, 138); // blue-900
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN ABSENSI SISWA', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${format(dateRange.from, 'dd MMMM yyyy')} - ${format(dateRange.to, 'dd MMMM yyyy')}`, 105, 24, { align: 'center' });
    
    const exportDate = format(new Date(), 'dd MMMM yyyy', { locale: id });
    doc.text(`Diekspor pada: ${exportDate}`, 105, 31, { align: 'center' });
    
    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Ringkasan Kehadiran', 14, 45);
    
    // Summary boxes
    const boxY = 52;
    const boxWidth = 35;
    const boxHeight = 25;
    
    // Hadir box
    doc.setFillColor(16, 185, 129); // green-500
    doc.roundedRect(14, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Hadir', 14 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(summaryStats.totalHadir.toString(), 14 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Terlambat box
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(14 + boxWidth + 5, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Terlambat', 14 + boxWidth + 5 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(summaryStats.totalTerlambat.toString(), 14 + boxWidth + 5 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Alpha box
    doc.setFillColor(239, 68, 68); // red-500
    doc.roundedRect(14 + (boxWidth + 5) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Alpha', 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(summaryStats.totalAlpha.toString(), 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Rata-rata box
    doc.setFillColor(59, 130, 246); // blue-500
    doc.roundedRect(14 + (boxWidth + 5) * 3, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Rata-rata', 14 + (boxWidth + 5) * 3 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${summaryStats.avgPercentage}%`, 14 + (boxWidth + 5) * 3 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Top Students Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('10 Siswa Terbaik', 14, 90);
    
    // Table header
    let tableY = 96;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(14, tableY, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('No', 16, tableY + 5.5);
    doc.text('Nama Siswa', 28, tableY + 5.5);
    doc.text('Kelas', 90, tableY + 5.5);
    doc.text('Hadir', 120, tableY + 5.5);
    doc.text('Terlambat', 140, tableY + 5.5);
    doc.text('Alpha', 165, tableY + 5.5);
    doc.text('%', 185, tableY + 5.5);
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    studentStatistics.slice(0, 10).forEach((s, index) => {
      tableY += 8;
      if (tableY > 270) {
        doc.addPage();
        tableY = 20;
      }
      
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(14, tableY, 182, 8, 'F');
      }
      
      doc.setFontSize(8);
      doc.text((index + 1).toString(), 16, tableY + 5.5);
      doc.text(s.student.nama_lengkap.substring(0, 25), 28, tableY + 5.5);
      doc.text(`${s.student.jurisdiction} ${s.student.kelas}`, 90, tableY + 5.5);
      doc.text(s.hadir.toString(), 120, tableY + 5.5);
      doc.text(s.terlambat.toString(), 140, tableY + 5.5);
      doc.text(s.alpha.toString(), 165, tableY + 5.5);
      doc.text(`${s.percentage}%`, 185, tableY + 5.5);
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Halaman ${i} dari ${pageCount}`, 105, 290, { align: 'center' });
      doc.text('Sistem Absensi Siswa', 14, 290);
    }
    
    doc.save(`laporan-absensi-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('File PDF berhasil diunduh');
  };

  // Render stat card
  const StatCard = ({ title, value, icon: Icon, color, subtitle }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    color: string;
    subtitle?: string;
  }) => (
    <Card className="overflow-hidden border-0 shadow-lg">
      <CardContent className="p-0">
        <div className={`h-2 bg-gradient-to-r ${color}`} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('from-', 'bg-').replace('to-', '/').split('/')[0]}/10`}>
              <Icon className={`w-6 h-6 ${color.replace('from-', 'text-').split(' ')[0]}`} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{title}</p>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Statistik Kehadiran</h1>
          <p className="text-slate-500 mt-1">Analisis dan laporan kehadiran siswa</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={exportToPDF} className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Date Range */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal min-w-[200px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => range && setDateRange(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Jurusan Filter */}
            <Select value={filterJurusan} onValueChange={setFilterJurusan}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Jurusan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jurusan</SelectItem>
                {uniqueJurusan.map((j) => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kelas Filter */}
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {['X', 'XI', 'XII'].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cari siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewType)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview" className="gap-1">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="class" className="gap-1">
            <GraduationCap className="w-4 h-4" />
            Per Kelas
          </TabsTrigger>
          <TabsTrigger value="student" className="gap-1">
            <Users className="w-4 h-4" />
            Per Siswa
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1">
            <FileText className="w-4 h-4" />
            Laporan
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Hadir"
              value={summaryStats.totalHadir}
              icon={CheckCircle2}
              color="from-green-500 to-emerald-500"
            />
            <StatCard
              title="Terlambat"
              value={summaryStats.totalTerlambat}
              icon={Clock}
              color="from-amber-500 to-orange-500"
            />
            <StatCard
              title="Alpha"
              value={summaryStats.totalAlpha}
              icon={XCircle}
              color="from-red-500 to-rose-500"
            />
            <StatCard
              title="Rata-rata"
              value={`${summaryStats.avgPercentage}%`}
              icon={TrendingUp}
              color="from-blue-500 to-indigo-500"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart - Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tren Kehadiran Harian</CardTitle>
                <CardDescription>Kehadiran per hari dalam periode yang dipilih</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-64">
                    <LineChart data={dailyAttendanceData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="hadir" stroke={COLORS.hadir} strokeWidth={2} dot={{ fill: COLORS.hadir }} name="Hadir" />
                      <Line type="monotone" dataKey="terlambat" stroke={COLORS.terlambat} strokeWidth={2} dot={{ fill: COLORS.terlambat }} name="Terlambat" />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribusi Kehadiran</CardTitle>
                <CardDescription>Persentase status kehadiran</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Area Chart - Weekly Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Tren Mingguan</CardTitle>
                <CardDescription>Rata-rata kehadiran per minggu</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ChartContainer config={{ percentage: { label: "Persentase", color: "#3b82f6" } }} className="h-64">
                    <AreaChart data={weeklyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="percentage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Persentase" />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Class Tab */}
        <TabsContent value="class" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classStatistics.map((classStat) => (
              <Card key={classStat.id} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{classStat.jurisdiction} {classStat.kelas}</span>
                    <Badge variant={classStat.percentage >= 90 ? 'default' : classStat.percentage >= 70 ? 'secondary' : 'destructive'}>
                      {classStat.percentage}%
                    </Badge>
                  </CardTitle>
                  <CardDescription>{classStat.totalSiswa} siswa</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Hadir</span>
                      </div>
                      <span className="font-medium">{classStat.hadir}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-sm">Terlambat</span>
                      </div>
                      <span className="font-medium">{classStat.terlambat}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm">Alpha</span>
                      </div>
                      <span className="font-medium">{classStat.alpha}</span>
                    </div>
                    <div className="pt-2">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                          style={{ width: `${classStat.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Student Tab */}
        <TabsContent value="student" className="space-y-6 mt-6">
          {/* Status Filter */}
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="good">Baik (≥90%)</SelectItem>
                <SelectItem value="warning">Perlu Perhatian (70-90%)</SelectItem>
                <SelectItem value="critical">Kritis (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Top Students */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Top 3 Students */}
            {studentStatistics.slice(0, 3).map((s, index) => (
              <Card key={s.student.id} className={`overflow-hidden border-0 shadow-lg ${index === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
                <CardContent className="p-0">
                  <div className={`h-2 ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-300' : 'bg-amber-700'}`} />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' : 
                        index === 1 ? 'bg-slate-100 text-slate-600' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.student.nama_lengkap}</p>
                        <p className="text-sm text-slate-500">{s.student.jurisdiction} {s.student.kelas}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{s.hadir}</p>
                        <p className="text-xs text-green-600">Hadir</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-amber-600">{s.terlambat}</p>
                        <p className="text-xs text-amber-600">Telat</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-red-600">{s.alpha}</p>
                        <p className="text-xs text-red-600">Alpha</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-600">{s.percentage}%</p>
                        <p className="text-xs text-blue-600">%</p>
                      </div>
                    </div>
                    {s.streak > 0 && (
                      <div className="mt-3 flex items-center gap-1 text-sm text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>Streak: {s.streak} hari</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Student Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daftar Siswa</CardTitle>
              <CardDescription>Berdasarkan persentase kehadiran</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Streak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentStatistics.map((s, index) => (
                    <TableRow key={s.student.id} className={index < 3 ? 'bg-yellow-50/50' : ''}>
                      <TableCell className="font-medium">
                        {index < 3 ? (
                          <Badge variant="outline" className={index === 0 ? 'border-yellow-400 text-yellow-600' : ''}>
                            {index + 1}
                          </Badge>
                        ) : (
                          index + 1
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{s.student.nama_lengkap}</TableCell>
                      <TableCell className="text-slate-500">{s.student.nis}</TableCell>
                      <TableCell>{s.student.jurisdiction} {s.student.kelas}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{s.hadir}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-600 font-medium">{s.terlambat}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600 font-medium">{s.alpha}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.percentage >= 90 ? 'default' : s.percentage >= 70 ? 'secondary' : 'destructive'}>
                          {s.percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.streak > 0 && (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <TrendingUp className="w-3 h-3" />
                            {s.streak}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6 mt-6">
          {/* Daily Report Table */}
          <Card>
            <CardHeader>
              <CardTitle>Laporan Harian</CardTitle>
              <CardDescription>Detail kehadiran per hari</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Persentase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyAttendanceData.map((d) => (
                    <TableRow key={d.dateKey}>
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{d.hadir}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-600 font-medium">{d.terlambat}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600 font-medium">{d.alpha}</span>
                      </TableCell>
                      <TableCell className="text-center">{d.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={d.percentage >= 90 ? 'default' : d.percentage >= 70 ? 'secondary' : 'destructive'}>
                          {d.percentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
