import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { axiosInstance } from '../../lib/axios';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select, { SelectItem } from '../../components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, FileText, Ellipsis, Eye, Download, Loader2, Info, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import Textarea from '../../components/ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Checkbox } from '../../components/ui/Checkbox';

export default function ContractGeneration() {
  // format a date like 8/15/2024 (US)
  const formatMDY = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch { return ''; }
  };
  const [lecturers, setLecturers] = useState([]);
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [term, setTerm] = useState('1');
  const [yearLevel, setYearLevel] = useState('');
  const [courses, setCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [contractId, setContractId] = useState(null);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  // management UI state
  const [contracts, setContracts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listAcademicYear, setListAcademicYear] = useState(''); // empty = All Years
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10); // infinite scroll page size
  // removed signature upload from actions menu per request
  const [showCreate, setShowCreate] = useState(false);
  // row actions menu state (match Lecturer Management behavior)
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0, dropUp: false });
  // delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, label: '' });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // cache hourly rates by lecturer user id
  const [ratesByLecturer, setRatesByLecturer] = useState({});
  // infinite scroll sentinel
  const sentinelRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  // Dialog form state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgLecturerId, setDlgLecturerId] = useState('');
  const [dlgHourlyRate, setDlgHourlyRate] = useState('');
  const [dlgStartDate, setDlgStartDate] = useState('');
  const [dlgEndDate, setDlgEndDate] = useState('');
  const [dlgDescription, setDlgDescription] = useState('');
  const [dlgErrors, setDlgErrors] = useState({});
  const [dlgSelectedMappingIds, setDlgSelectedMappingIds] = useState(new Set());
  const [dlgCourseQuery, setDlgCourseQuery] = useState('');

  // Currently open contract (for Actions menu)
  const currentMenuContract = useMemo(() => {
    return (contracts || []).find(x => x.id === openMenuId) || null;
  }, [contracts, openMenuId]);

  // Filter mappings for dialog course list
  const dlgFilteredMappings = useMemo(() => {
    const q = (dlgCourseQuery || '').toLowerCase();
    const list = (mappings || []).filter(m => {
      if (!q) return true;
      const cname = m.course?.name?.toLowerCase() || '';
      const ccode = m.course?.code?.toLowerCase() || '';
      const cls = m.class?.name?.toLowerCase() || '';
      const meta = `${m.term || ''} ${m.year_level || ''}`.toLowerCase();
      return cname.includes(q) || ccode.includes(q) || cls.includes(q) || meta.includes(q);
    });
    return list;
  }, [mappings, dlgCourseQuery]);

  // Validate and create draft via dialog
  const handleCreateContract = async () => {
    const errs = {};
    const today = new Date(); today.setHours(0,0,0,0);
    const sd = dlgStartDate ? new Date(dlgStartDate) : null;
    const ed = dlgEndDate ? new Date(dlgEndDate) : null;
    if (!dlgLecturerId) errs.lecturer = 'Lecturer is required';
  // Hourly rate is optional for creation; it can be filled later
    if (!sd) errs.startDate = 'Start Date is required';
    else if (sd < today) errs.startDate = 'Start Date cannot be in the past';
    if (!ed) errs.endDate = 'End Date is required';
    else if (sd && ed <= sd) errs.endDate = 'End Date must be after Start Date';
    if (!dlgDescription?.trim()) errs.description = 'Description is required';
    else if (dlgDescription.length > 160) errs.description = 'Description must be at most 160 characters';
    // Build selected courses from dialog selection
    const selectedMappings = (mappings || []).filter(m => dlgSelectedMappingIds.has(m.id));
    if (selectedMappings.length === 0) errs.courses = 'Please select at least one course to include in this contract.';
    setDlgErrors(errs);
    if (Object.keys(errs).length) return;
    // Map to payload shape
    const selectedCoursesPayload = selectedMappings.map(m => ({
      course_id: m.course?.id,
      class_id: m.class?.id,
      course_name: m.course?.name,
      year_level: m.year_level,
      term: m.term,
      academic_year: m.academic_year,
      hours: m.course?.hours
    }));
  // Create draft with explicit lecturer, courses, and period dates
  await createDraft({ lecturerId: dlgLecturerId, courses: selectedCoursesPayload, start_date: dlgStartDate, end_date: dlgEndDate });
    setDlgOpen(false);
  };

  useEffect(() => {
    // fetch lecturers (users with lecturer role) via existing endpoint
    axiosInstance.get('/lecturers').then(res => setLecturers(res.data?.data || [])).catch(()=>{});
  }, []);

  useEffect(() => {
    // fetch assigned course mappings for the selected academic year
    axiosInstance.get('/course-mappings', { params: { academic_year: academicYear, limit: 100 } })
      .then(res => setMappings(res.data?.data || []))
      .catch(()=>{});
  }, [academicYear]);

  // fetch contracts list (append on next pages)
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get('/teaching-contracts', { params: { page, limit, q: search || undefined, status: statusFilter || undefined, academic_year: listAcademicYear || undefined } });
        const data = res.data?.data || [];
        const totalCount = res.data?.total || 0;
        setTotal(totalCount);
        setHasMore(page * limit < totalCount);
        setContracts(prev => (page === 1 ? data : [...prev, ...data]));
      } catch (e) {
        // noop
      } finally {
        setLoading(false);
      }
    };
    fetchContracts();
  }, [page, limit, search, statusFilter, listAcademicYear]);

  // reset list when filters/search change
  useEffect(() => {
    setPage(1);
    setContracts([]);
    setHasMore(true);
  }, [search, statusFilter, listAcademicYear]);

  // intersection observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && !loading && hasMore) {
        setPage(p => p + 1);
      }
    }, { root: null, rootMargin: '0px', threshold: 1.0 });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, loading, hasMore]);

  // Fetch hourly rates for lecturers present in the current page (cached)
  useEffect(() => {
    const ids = Array.from(new Set((contracts || []).map(c => c.lecturer_user_id).filter(Boolean)));
    const missing = ids.filter(id => !(id in ratesByLecturer));
    if (missing.length === 0) return;
    (async () => {
      try {
        const results = await Promise.all(missing.map(async (id) => {
          try {
            const res = await axiosInstance.get(`/lecturers/${id}/detail`);
            const raw = res.data?.hourlyRateThisYear;
            const n = raw != null ? parseFloat(String(raw).replace(/[^0-9.\-]/g, '')) : null;
            return [id, Number.isFinite(n) ? n : null];
          } catch {
            return [id, null];
          }
        }));
        setRatesByLecturer(prev => {
          const next = { ...prev };
          for (const [id, rate] of results) next[id] = rate;
          return next;
        });
      } catch {
        // ignore batch errors; individual entries handled above
      }
    })();
  }, [contracts, ratesByLecturer]);

  const formatRate = (n) => {
    if (n == null) return null;
    try {
      const v = Number(n);
      if (!Number.isFinite(v)) return null;
      return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}/hr`;
    } catch {
      return null;
    }
  };

  const addCourse = (m) => {
    setCourses(prev => [...prev, {
      course_id: m.course?.id,
      class_id: m.class?.id,
      course_name: m.course?.name,
      year_level: m.year_level,
      term: m.term,
      academic_year: m.academic_year,
      hours: m.course?.hours
    }]);
  };

  const createDraft = async (override = {}) => {
    const payload = {
      lecturer_user_id: override.lecturerId || selectedLecturer?.user_id || selectedLecturer?.id || selectedLecturer,
      academic_year: academicYear,
      term,
      year_level: yearLevel,
      start_date: override.start_date || undefined,
      end_date: override.end_date || undefined,
      courses: override.courses || courses
    };
    const res = await axiosInstance.post('/teaching-contracts', payload);
    setContractId(res.data.id);
  setLastCreatedId(res.data.id);
    setShowCreate(false);
    // refresh list
    try {
      const r = await axiosInstance.get('/teaching-contracts', { params: { page: 1, limit, q: search || undefined, status: statusFilter || undefined, academic_year: listAcademicYear || undefined } });
      setContracts(r.data?.data || []);
      setTotal(r.data?.total || 0);
      setHasMore(limit < (r.data?.total || 0));
      setPage(1);
    } catch {}
  };

  const previewPdf = () => {
    if (!contractId) return;
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${contractId}/pdf`;
    window.open(url, '_blank');
  };

  const previewPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };

  const downloadPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    // open in new tab; user can save
    window.open(url, '_blank');
  };

  const deleteContract = async (id) => {
    if (!id) return { ok: false, message: 'Invalid id' };
    try {
      await axiosInstance.delete(`/teaching-contracts/${id}`);
      // Optimistically remove from UI and adjust total
      setContracts(prev => prev.filter(c => c.id !== id));
      setTotal(t => Math.max(0, (t || 0) - 1));
      return { ok: true };
    } catch (e) {
      const message = e?.response?.data?.message || 'Failed to delete contract';
      console.error('Failed to delete contract', e);
      return { ok: false, message };
    }
  };

  const openDeleteConfirm = (id) => {
    if (!id) return;
    const c = (contracts || []).find(x => x.id === id);
    let label = `#${id}`;
    if (c) {
      const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
      label = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
    }
  setDeleteError('');
  setDeleteBusy(false);
  setConfirmDelete({ open: true, id, label });
    closeMenu();
  };

  // open/close actions menu like Lecturer Management
  const openMenu = (id, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
  const menuHeight = 168; // approximate height for 3 items
    const gap = 8;
    const shouldDropUp = (rect.bottom + menuHeight + gap) > window.innerHeight;
    const dropUp = shouldDropUp;
    const y = dropUp
      ? Math.max(rect.top - menuHeight - gap, gap)
      : Math.min(rect.bottom + gap, Math.max(window.innerHeight - menuHeight - gap, gap));
    const width = 176; // w-44
    const rawX = rect.right - width;
    const x = Math.min(Math.max(rawX, gap), Math.max(window.innerWidth - width - gap, gap));
    setMenuCoords({ x, y, dropUp });
    setOpenMenuId(id);
  };
  const closeMenu = () => setOpenMenuId(null);

  // close on outside click, scroll, resize, or Escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('.contract-action-menu')) closeMenu();
    };
    const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    const onScrollOrResize = () => closeMenu();
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-5">
  {/* Removed post-creation banner */}
      {/* Page header */}
      <div className="flex items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Contract Management</h1>
          <p className="text-gray-600 mt-1">Generate and manage lecturer contracts</p>
        </div>
        <Button onClick={() => setDlgOpen(true)} className="inline-flex items-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Generate Contract
        </Button>
      </div>

      {/* Generate New Contract Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="w-full max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Generate New Contract</DialogTitle>
            <DialogDescription>Fill in the details below to generate a new contract.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 max-h-[70vh] overflow-y-auto">
            {/* Lecturer Information */}
            <div className="space-y-1 mb-4">
              <label className="block text-sm font-medium">Lecturer Name <span className="text-red-600">*</span></label>
              <Select className="cursor-pointer" value={dlgLecturerId} onValueChange={async (val)=>{
                setDlgLecturerId(val);
                setDlgErrors(prev=>({ ...prev, lecturer: '' }));
                setDlgSelectedMappingIds(new Set()); // reset selections on lecturer change
                // Fetch hourly rate for selected lecturer
                try {
                  const res = await axiosInstance.get(`/lecturers/${val}/detail`);
                  const rate = res.data?.hourlyRateThisYear || '';
                  setDlgHourlyRate(rate);
                } catch { setDlgHourlyRate(''); }
              }} placeholder="Select lecturer">
                {lecturers.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name || l.full_name_english || l.full_name_khmer}</SelectItem>
                ))}
              </Select>
              {dlgErrors.lecturer && <p className="text-xs text-red-600">{dlgErrors.lecturer}</p>}
            </div>

            {/* Contract Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">Hourly Rate (KHR)</label>
                <Input className="cursor-pointer" value={dlgHourlyRate} readOnly />
                {dlgErrors.hourlyRate && <p className="text-xs text-red-600">{dlgErrors.hourlyRate}</p>}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Start Date <span className="text-red-600">*</span></label>
                <Input className="cursor-pointer" type="date" value={dlgStartDate} min={new Date().toISOString().slice(0,10)} onChange={e=>{ setDlgStartDate(e.target.value); setDlgErrors(prev=>({ ...prev, startDate: '' })); }}/>
                {dlgErrors.startDate && <p className="text-xs text-red-600">{dlgErrors.startDate}</p>}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">End Date <span className="text-red-600">*</span></label>
                <Input className="cursor-pointer" type="date" value={dlgEndDate} min={dlgStartDate || new Date().toISOString().slice(0,10)} onChange={e=>{ setDlgEndDate(e.target.value); setDlgErrors(prev=>({ ...prev, endDate: '' })); }}/>
                {dlgErrors.endDate && <p className="text-xs text-red-600">{dlgErrors.endDate}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-sm font-medium">Description <span className="text-red-600">*</span></label>
              <Textarea className="cursor-pointer" rows={4} maxLength={160} value={dlgDescription} onChange={e=>{ setDlgDescription(e.target.value); setDlgErrors(prev=>({ ...prev, description: '' })); }} placeholder="Short description (max 160 characters)" />
              <div className="flex justify-between text-xs">
                {dlgErrors.description ? <span className="text-red-600">{dlgErrors.description}</span> : <span className="text-gray-500">{160 - (dlgDescription?.length || 0)} characters remaining</span>}
              </div>
            </div>

            {/* Courses selection */}
            <div className="mt-5">
              <label className="block text-sm font-medium mb-1">Courses to include <span className="text-red-600">*</span></label>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input className="pl-9" placeholder="Search by course name/code or class…" value={dlgCourseQuery} onChange={e=>setDlgCourseQuery(e.target.value)} />
                </div>
                {dlgCourseQuery && (
                  <button onClick={()=>setDlgCourseQuery('')} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                )}
              </div>
              <div className="rounded-lg border max-h-56 overflow-y-auto divide-y bg-white">
                {dlgFilteredMappings.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No courses found for {academicYear}.</div>
                ) : (
                  dlgFilteredMappings.map(m => {
                    const checked = dlgSelectedMappingIds.has(m.id);
                    const hours = m.course?.hours ?? '-';
                    return (
                      <label key={m.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                        <Checkbox id={`map-${m.id}`} checked={checked} onCheckedChange={() => {
                          const next = new Set(Array.from(dlgSelectedMappingIds));
                          if (checked) next.delete(m.id); else next.add(m.id);
                          setDlgSelectedMappingIds(next);
                          setDlgErrors(prev=>({ ...prev, courses: '' }));
                        }} />
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{m.course?.name} <span className="text-gray-500 font-normal">({hours}h)</span></div>
                          <div className="text-xs text-gray-600">{m.class?.name || 'Class'} • Year {m.year_level} • Term {m.term} • {m.academic_year}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              {dlgErrors.courses && <p className="text-xs text-red-600 mt-1">{dlgErrors.courses}</p>}
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={()=> setDlgOpen(false)}>Cancel</Button>
            <Button className="cursor-pointer" onClick={handleCreateContract}>Generate Contract</Button>
          </div>
          {/* keep footer clean; courses error shown near list */}
        </DialogContent>
      </Dialog>

      {/* Create form card */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600"/> New Contract</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm mb-1">Lecturer</label>
              <Select value={selectedLecturer} onValueChange={setSelectedLecturer} placeholder="Select lecturer">
                {lecturers.map(l => (
                  <SelectItem key={l.id} value={l.user_id || l.id}>{l.name || l.full_name_english || l.full_name_khmer}</SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Academic Year</label>
              <Input value={academicYear} onChange={e=>setAcademicYear(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Term</label>
              <Input value={term} onChange={e=>setTerm(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Year Level</label>
              <Input value={yearLevel} onChange={e=>setYearLevel(e.target.value)} />
            </div>
          </div>
          <div className="px-4 pb-4">
            <h4 className="font-medium mb-2">Assigned Courses</h4>
            <div className="rounded-lg border divide-y">
              {mappings.map(m => (
                <div key={m.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{m.course?.name}</div>
                    <div className="text-sm text-gray-600">Year {m.year_level} • Term {m.term} • {m.academic_year} • Hours {m.course?.hours}</div>
                  </div>
                  <Button size="sm" onClick={()=>addCourse(m)}>Add</Button>
                </div>
              ))}
              {mappings.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No mappings found for {academicYear}.</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={createDraft} disabled={!selectedLecturer || courses.length===0}>Create Draft</Button>
              <Button variant="secondary" onClick={previewPdf} disabled={!contractId}>Preview PDF</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2">
        {/* Search & filter bar */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9 rounded-xl" placeholder="Search by contract ID, lecturer name, or department…" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <Select value={statusFilter} onValueChange={v=>{ setStatusFilter(v); setPage(1); }} placeholder="All Status">
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="LECTURER_SIGNED">Lecturer Signed</SelectItem>
              <SelectItem value="MANAGEMENT_SIGNED">Management Signed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </Select>
          </div>
          {/* Removed All Years, Page size, Filters, and Reset buttons as requested */}
        </div>

  <div className="mt-3 md:mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600"/>
              <div className="font-semibold">Contracts ({total})</div>
              <div className="ml-auto text-sm text-gray-600">{(contracts?.length||0)} of {total}</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">All lecturer contracts</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Contract ID</TableHead>
                <TableHead className="whitespace-nowrap">Lecturer</TableHead>
                <TableHead className="whitespace-nowrap">Department</TableHead>
                <TableHead className="whitespace-nowrap">Period</TableHead>
                <TableHead className="whitespace-nowrap">Rate</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loading && contracts.length === 0) && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="animate-pulse">
                  <TableCell><div className="h-4 w-24 bg-gray-200 rounded"/></TableCell>
                  <TableCell>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-1"/>
                    <div className="h-3 w-40 bg-gray-100 rounded"/>
                  </TableCell>
                  <TableCell><div className="h-4 w-32 bg-gray-200 rounded"/></TableCell>
                  <TableCell><div className="h-4 w-28 bg-gray-200 rounded"/></TableCell>
                  <TableCell><div className="h-4 w-16 bg-gray-200 rounded"/></TableCell>
                  <TableCell><div className="h-5 w-20 bg-gray-100 rounded-full"/></TableCell>
                  <TableCell className="text-right"><div className="h-8 w-8 bg-gray-100 rounded" style={{display:'inline-block'}}/></TableCell>
                </TableRow>
              ))}
              {(contracts || []).map(c => {
                const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
                const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
                const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
                const rate = ratesByLecturer[c.lecturer_user_id];
                const startDate = c.start_date || c.startDate || c.start || null;
                const endDate = c.end_date || c.endDate || c.end || null;
                const hasBothDates = !!(startDate && endDate);
                const hasAnyDate = !!(startDate || endDate);
                const period = `Term ${c.term} • ${c.academic_year}`;
                const dept = c.lecturer?.department_name || '-';
                const lecturerName = c.lecturer?.display_name || c.lecturer?.full_name || c.lecturer?.email;
                const statusMap = {
                  DRAFT: { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: null },
                  LECTURER_SIGNED: { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
                  MANAGEMENT_SIGNED: { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
                  COMPLETED: { label: 'completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
                };
                const st = statusMap[c.status] || statusMap.DRAFT;
                return (
                  <TableRow key={c.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{formattedId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{lecturerName}</div>
                      <div className="text-xs text-gray-500">{c.lecturer?.email}</div>
                    </TableCell>
                    <TableCell>{dept}</TableCell>
                    <TableCell>
                      {hasBothDates ? (
                        <div className="text-gray-900 leading-tight">
                          <div>{formatMDY(startDate)}</div>
                          <div className="text-gray-600">to {formatMDY(endDate)}</div>
                        </div>
                      ) : hasAnyDate ? (
                        <div className="text-gray-900 leading-tight">
                          <div>{formatMDY(startDate || endDate)}</div>
                          <div className="text-gray-600">{period}</div>
                        </div>
                      ) : (
                        <div className="text-gray-900">{period}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-900 leading-tight">
                        <div className="font-medium">{formatRate(rate) ?? '-'}</div>
                        <div className="text-gray-600">{hours}h total</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${st.class}`}>
                        {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right contract-action-menu">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === c.id}
                        onClick={(e) => openMenu(c.id, e)}
                        aria-label="Open actions"
                      >
                        <Ellipsis className="w-5 h-5 text-gray-600" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!contracts || contracts.length === 0) && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-500 py-6">No contracts found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="flex justify-center items-center py-4 text-sm text-gray-500">
          {loading ? 'Loading…' : (hasMore ? 'Scroll to load more' : 'No more results')}
        </div>
      </div>
      {/* Floating actions menu (portal) */}
      {openMenuId && ReactDOM.createPortal(
        <div className="fixed z-50 contract-action-menu" style={{ top: menuCoords.y, left: menuCoords.x }}>
          <div className="w-44 bg-white border border-gray-200 rounded-md shadow-lg py-2 text-sm">
            <button onClick={() => { previewPdfFor(openMenuId); closeMenu(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"><Eye className="w-4 h-4"/> View Contract</button>
            <button onClick={() => { downloadPdfFor(openMenuId); closeMenu(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"><Download className="w-4 h-4"/> Download PDF</button>
            {currentMenuContract?.status === 'DRAFT' && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button onClick={() => { openDeleteConfirm(openMenuId); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-left text-red-600"><Trash2 className="w-4 h-4"/> Delete</button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete.open} onOpenChange={(v)=> setConfirmDelete(prev => ({ ...prev, open: v }))}>
        <DialogContent className="w-full max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="text-left">Delete Contract</DialogTitle>
            <DialogDescription className="text-left mt-3">
              Do you want to delete this {confirmDelete.label}?
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="px-6 -mt-1 text-sm text-red-600">{deleteError}</div>
          )}
          <div className="px-6 py-5 flex justify-center gap-2 border-t">
            <Button
              className="min-w-[88px] bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteBusy}
              onClick={async () => {
                const id = confirmDelete.id;
                setDeleteError('');
                setDeleteBusy(true);
                const result = await deleteContract(id);
                setDeleteBusy(false);
                if (result.ok) {
                  setConfirmDelete({ open: false, id: null, label: '' });
                } else {
                  setDeleteError(result.message || 'Unable to delete this contract.');
                }
              }}
            >
              {deleteBusy ? 'Deleting…' : 'OK'}
            </Button>
            <Button
              variant="outline"
              className="min-w-[88px]"
              disabled={deleteBusy}
              onClick={() => setConfirmDelete({ open: false, id: null, label: '' })}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
