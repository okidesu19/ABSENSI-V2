'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, RefreshCw, Building2, Users, Edit, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

// New structure interfaces
interface LabelData {
  id: string;
  kelas: string[]; // ["X", "XI", "XII"]
}

interface ClassData {
  id: string;
  nama_jurusan: string;
  singkatan: string;
  label: Record<string, { kelas: string[] }>; // { "-id": { kelas: ["X", "XI", "XII"] } }
  created_at: number;
}

interface Student {
  id: string;
  nis: string;
  nama_lengkap: string;
  jurusan: string; // e.g., "TJKT 1"
  kelas: string;
}

const tingkatOptions = ['X', 'XI', 'XII'];

export default function KelasTab() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteJurusanDialogOpen, setIsDeleteJurusanDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ jurusanId: string; labelId: string; singkatan: string; labelNum: number } | null>(null);
  const [deletingJurusan, setDeletingJurusan] = useState<{ id: string; nama_jurusan: string; singkatan: string } | null>(null);
  
  // Form state
  const [formMode, setFormMode] = useState<'add_jurusan' | 'add_label'>('add_jurusan');
  const [selectedJurusanId, setSelectedJurusanId] = useState<string>('');
  const [formData, setFormData] = useState({
    nama_jurusan: '',
    singkatan: '',
    tingkat: [] as string[]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const classesRef = ref(database, 'classes');
    const unsubscribeClasses = onValue(classesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const classList: ClassData[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<ClassData, 'id'>)
        }));
        // Sort by nama_jurusan
        classList.sort((a, b) => a.nama_jurusan.localeCompare(b.nama_jurusan));
        setClasses(classList);
      } else {
        setClasses([]);
      }
      setLoading(false);
    });

    // Fetch students for counting
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

    return () => {
      unsubscribeClasses();
      unsubscribeStudents();
    };
  }, []);

  // Count students for a specific jurusan and kelas
  const countStudents = (jurusanCode: string, kelas: string) => {
    return students.filter(s => s.jurusan === jurusanCode && s.kelas === kelas).length;
  };

  // Count total students for a jurusan code
  const countTotalStudents = (jurusanCode: string) => {
    return students.filter(s => s.jurusan === jurusanCode).length;
  };

  // Get next label number for a jurusan
  const getNextLabelNumber = (jurusanId: string) => {
    const jurusan = classes.find(c => c.id === jurusanId);
    if (!jurusan || !jurusan.label) return 1;
    const labelNumbers = Object.keys(jurusan.label).length;
    return labelNumbers + 1;
  };

  // Get next label number by singkatan
  const getNextLabelBySingkatan = (singkatan: string) => {
    const jurusan = classes.find(c => c.singkatan === singkatan);
    if (!jurusan || !jurusan.label) return 1;
    return Object.keys(jurusan.label).length + 1;
  };

  // Check if singkatan already exists
  const singkatanExists = (singkatan: string) => {
    return classes.some(c => c.singkatan === singkatan);
  };

  const openAddJurusanModal = () => {
    setFormMode('add_jurusan');
    setSelectedJurusanId('');
    setFormData({ nama_jurusan: '', singkatan: '', tingkat: ['X', 'XI', 'XII'] });
    setIsModalOpen(true);
  };

  const openAddLabelModal = (jurusanId: string) => {
    const jurusan = classes.find(c => c.id === jurusanId);
    if (!jurusan) return;
    
    setFormMode('add_label');
    setSelectedJurusanId(jurusanId);
    setFormData({ 
      nama_jurusan: jurusan.nama_jurusan, 
      singkatan: jurusan.singkatan, 
      tingkat: ['X', 'XI', 'XII'] 
    });
    setIsModalOpen(true);
  };

  const handleSingkatanChange = (value: string) => {
    const singkatan = value.toUpperCase().replace(/[^A-Z]/g, '');
    setFormData(prev => ({ ...prev, singkatan }));
  };

  const handleSave = async () => {
    if (!formData.nama_jurusan || !formData.singkatan || formData.tingkat.length === 0) {
      toast.error('Mohon lengkapi semua field');
      return;
    }

    setSaving(true);
    try {
      if (formMode === 'add_jurusan') {
        // Create new jurusan with first label
        const newJurusanRef = push(ref(database, 'classes'));
        const newLabelRef = push(ref(database, `classes/${newJurusanRef.key}/label`));
        
        await set(newJurusanRef, {
          nama_jurusan: formData.nama_jurusan,
          singkatan: formData.singkatan,
          label: {
            [newLabelRef.key!]: {
              kelas: formData.tingkat
            }
          },
          created_at: Date.now()
        });
        
        toast.success(`Jurusan ${formData.singkatan} berhasil ditambahkan`);
      } else {
        // Add new label to existing jurusan
        if (!selectedJurusanId) {
          toast.error('Jurusan tidak ditemukan');
          return;
        }
        
        const newLabelRef = push(ref(database, `classes/${selectedJurusanId}/label`));
        await set(newLabelRef, {
          kelas: formData.tingkat
        });
        
        toast.success(`Label baru untuk ${formData.singkatan} berhasil ditambahkan`);
      }
      
      setIsModalOpen(false);
      setFormData({ nama_jurusan: '', singkatan: '', tingkat: [] });
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Terjadi kesalahan saat menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (!deletingItem) return;

    try {
      await remove(ref(database, `classes/${deletingItem.jurusanId}/label/${deletingItem.labelId}`));
      toast.success(`${deletingItem.singkatan} ${deletingItem.labelNum} berhasil dihapus`);
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
    } catch (error) {
      console.error('Error deleting label:', error);
      toast.error('Terjadi kesalahan saat menghapus data');
    }
  };

  const handleDeleteJurusan = async () => {
    if (!deletingJurusan) return;

    try {
      await remove(ref(database, `classes/${deletingJurusan.id}`));
      toast.success(`Jurusan ${deletingJurusan.singkatan} berhasil dihapus`);
      setIsDeleteJurusanDialogOpen(false);
      setDeletingJurusan(null);
    } catch (error) {
      console.error('Error deleting jurusan:', error);
      toast.error('Terjadi kesalahan saat menghapus data');
    }
  };

  // Parse labels from class data
  const parseLabels = (labelObj: Record<string, { kelas: string[] }> | undefined): { id: string; kelas: string[] }[] => {
    if (!labelObj) return [];
    return Object.entries(labelObj).map(([id, data]) => ({
      id,
      kelas: data.kelas || []
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Kelas</h1>
          <p className="text-slate-500 mt-1">Kelola data kelas dan jurusan</p>
        </div>
        <Button onClick={openAddJurusanModal} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Jurusan Baru
        </Button>
      </div>

      {/* Classes Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Building2 className="w-12 h-12 mb-4 opacity-50" />
              <p>Belum ada data jurusan</p>
              <Button variant="link" onClick={openAddJurusanModal} className="mt-2">
                Tambah jurusan pertama
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="w-[300px] font-bold text-slate-700">JURUSAN</TableHead>
                    <TableHead className="w-[100px] text-center font-bold text-slate-700">Label</TableHead>
                    <TableHead className="font-bold text-slate-700">KELAS</TableHead>
                    <TableHead className="w-[120px] text-center font-bold text-slate-700">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((jurusan) => {
                    const labels = parseLabels(jurusan.label);
                    const totalRows = labels.reduce((sum, label) => sum + label.kelas.length, 0);
                    
                    return labels.map((label, labelIndex) => {
                      const labelNum = labelIndex + 1;
                      const jurusanCode = `${jurusan.singkatan} ${labelNum}`;
                      const sortedKelas = [...label.kelas].sort((a, b) => 
                        tingkatOptions.indexOf(a) - tingkatOptions.indexOf(b)
                      );
                      
                      return sortedKelas.map((kelas, classIndex) => {
                        const isFirstInJurusan = labelIndex === 0 && classIndex === 0;
                        const isFirstInLabel = classIndex === 0;
                        const studentCount = countStudents(jurusanCode, kelas);
                        const totalStudentsInLabel = countTotalStudents(jurusanCode);
                        
                        return (
                          <TableRow key={`${jurusan.id}-${label.id}-${kelas}`} className="hover:bg-slate-50">
                            {/* Nama Jurusan - rowspan for entire jurusan */}
                            {isFirstInJurusan && (
                              <TableCell 
                                rowSpan={totalRows} 
                                className="font-medium border-r bg-slate-50/50 align-top"
                              >
                                <div className="py-2">
                                  <p className="font-semibold text-slate-800">{jurusan.nama_jurusan}</p>
                                  <p className="text-xs text-slate-500 mt-1">({jurusan.singkatan})</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 h-7 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                                    onClick={() => {
                                      setDeletingJurusan({
                                        id: jurusan.id,
                                        nama_jurusan: jurusan.nama_jurusan,
                                        singkatan: jurusan.singkatan
                                      });
                                      setIsDeleteJurusanDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Hapus Jurusan
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                            
                            {/* Label - rowspan for all classes in this label */}
                            {isFirstInLabel && (
                              <TableCell 
                                rowSpan={sortedKelas.length} 
                                className="text-center border-r bg-blue-50/50 align-top"
                              >
                                <div className="flex flex-col items-center py-2">
                                  <Badge className="bg-blue-600 text-white text-lg px-4 py-1">
                                    {labelNum}
                                  </Badge>
                                  <span className="text-xs text-slate-500 mt-1">{jurusan.singkatan} {labelNum}</span>
                                  <span className="text-xs text-green-600 font-medium mt-1">
                                    {totalStudentsInLabel} siswa
                                  </span>
                                  <div className="flex gap-1 mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                                      onClick={() => {
                                        setDeletingItem({
                                          jurusanId: jurusan.id,
                                          labelId: label.id,
                                          singkatan: jurusan.singkatan,
                                          labelNum
                                        });
                                        setIsDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            )}
                            
                            {/* Kelas */}
                            <TableCell>
                              <div className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">-</span>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-medium">
                                    {kelas}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                  <Users className="w-4 h-4" />
                                  <span>{studentCount} siswa</span>
                                </div>
                              </div>
                            </TableCell>
                            
                            {/* Aksi - only show on first row of each label */}
                            {isFirstInLabel && (
                              <TableCell 
                                rowSpan={sortedKelas.length} 
                                className="text-center align-top"
                              >
                                <div className="py-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => openAddLabelModal(jurusan.id)}
                                  >
                                    <PlusCircle className="w-4 h-4 mr-1" />
                                    Tambah Label
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      });
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formMode === 'add_jurusan' ? 'Tambah Jurusan Baru' : `Tambah Label Baru untuk ${formData.singkatan}`}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'add_jurusan' 
                ? 'Tambahkan jurusan baru ke dalam sistem' 
                : `Menambah label ke-${getNextLabelBySingkatan(formData.singkatan)} untuk jurusan ${formData.nama_jurusan}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formMode === 'add_jurusan' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nama_jurusan">Nama Jurusan (Lengkap)</Label>
                  <Input
                    id="nama_jurusan"
                    placeholder="Contoh: Teknik Jaringan Komputer & Telekomunikasi"
                    value={formData.nama_jurusan}
                    onChange={(e) => setFormData(prev => ({ ...prev, nama_jurusan: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="singkatan">Singkatan Jurusan</Label>
                  <Input
                    id="singkatan"
                    placeholder="Contoh: TJKT"
                    value={formData.singkatan}
                    onChange={(e) => handleSingkatanChange(e.target.value)}
                    maxLength={10}
                  />
                  {singkatanExists(formData.singkatan) && formData.singkatan && (
                    <p className="text-xs text-amber-600">
                      Singkatan {formData.singkatan} sudah digunakan. Gunakan singkatan lain.
                    </p>
                  )}
                </div>
              </>
            )}

            {formMode === 'add_label' && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Jurusan:</strong> {formData.nama_jurusan}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Singkatan:</strong> {formData.singkatan}
                </p>
                <p className="text-sm text-blue-600 font-medium mt-2">
                  Label baru: <strong>{formData.singkatan} {getNextLabelBySingkatan(formData.singkatan)}</strong>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tingkat Kelas</Label>
              <div className="flex flex-wrap gap-4">
                {tingkatOptions.map(tingkat => (
                  <label key={tingkat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.tingkat.includes(tingkat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, tingkat: [...prev.tingkat, tingkat] }));
                        } else {
                          setFormData(prev => ({ ...prev, tingkat: prev.tingkat.filter(t => t !== tingkat) }));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span>Kelas {tingkat}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">Pilih tingkat kelas yang tersedia</p>
            </div>

            {/* Preview */}
            {formData.nama_jurusan && formData.singkatan && formData.tingkat.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Preview Data yang akan disimpan:</p>
                <div className="space-y-1">
                  {formMode === 'add_jurusan' && (
                    <p className="font-semibold">{formData.nama_jurusan}</p>
                  )}
                  <div className="ml-4">
                    <p className="text-blue-600 font-medium">
                      {formData.singkatan} {formMode === 'add_jurusan' ? 1 : getNextLabelBySingkatan(formData.singkatan)}
                    </p>
                    <ul className="ml-4 text-sm text-slate-600">
                      {formData.tingkat.sort((a, b) => tingkatOptions.indexOf(a) - tingkatOptions.indexOf(b)).map(t => (
                        <li key={t}>- Kelas {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || (formMode === 'add_jurusan' && singkatanExists(formData.singkatan))} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Label Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Label?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deletingItem?.singkatan} {deletingItem?.labelNum}</strong>?
              Semua data kelas untuk label ini akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLabel} className="bg-red-600 hover:bg-red-700">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Jurusan Confirmation */}
      <AlertDialog open={isDeleteJurusanDialogOpen} onOpenChange={setIsDeleteJurusanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jurusan?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus jurusan <strong>{deletingJurusan?.nama_jurusan}</strong> ({deletingJurusan?.singkatan})?
              Semua label dan data kelas untuk jurusan ini akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJurusan} className="bg-red-600 hover:bg-red-700">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
