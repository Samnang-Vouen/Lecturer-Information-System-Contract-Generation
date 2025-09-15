import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { axiosInstance } from '../../lib/axios';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select, { SelectItem } from '../../components/ui/Select';
import { Plus, Search, FileText, Ellipsis, Eye, Download, Loader2, Info, CheckCircle2, Clock, Trash2, Calendar, User, DollarSign, GraduationCap, Building2 } from 'lucide-react';
import Textarea from '../../components/ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Checkbox } from '../../components/ui/Checkbox';
import { useAuthStore } from '../../store/useAuthStore';

export default function ContractGeneration() {
  // Pull current user for client-side scoping hints
  // Note: enforcement is server-side; this only helps hide out-of-scope rows if any leak
  const { authUser } = useAuthStore();
  // ...existing code... (keeping all the helper functions and state unchanged)
  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const toBool = (v) => {
    if (v == null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  };
  const normId = (v) => (v == null ? null : String(v));
  const lecturerUserIdFromMapping = (m) => {
    return normId(
      m?.lecturer_user_id ??
      m?.lecturer?.user_id ??
      m?.lecturer?.id ??
      m?.user_id ?? null
    );
  };
  const lecturerDisplayFromMapping = (m) => {
    const title = m?.lecturer?.title || m?.lecturer?.academic_title || m?.lecturer?.title_english || m?.lecturer?.title_khmer || '';
    const name = m?.lecturer?.display_name || m?.lecturer?.full_name || m?.lecturer?.full_name_english || m?.lecturer?.full_name_khmer || m?.lecturer?.name || m?.lecturer?.email || '';
    return `${title ? `${title} ` : ''}${name || ''}`.trim();
  };
  const hoursFromMapping = (m) => {
    if (!m || typeof m !== 'object') return 0;
    const typeHoursStr = String(m.type_hours || '');
    const th = String(m.theory_hours || '').toLowerCase();
    const theory15 = th === '15h' || (!th && /15h/i.test(typeHoursStr));
    const theory30 = th === '30h' || (!th && /30h/i.test(typeHoursStr));
    const theoryGroups = toInt(m.theory_groups ?? m.groups_15h ?? m.groups_theory ?? m.group_count_theory ?? 0);
    const labGroups = toInt(m.lab_groups ?? m.practice_groups ?? m.practical_groups ?? m.groups_30h ?? m.groups_lab ?? m.group_count_lab ?? 0);
    const theoryCombined = toBool(m.theory_combined ?? m.theory_15h_combined ?? m.combine_theory_groups ?? m.combined_theory ?? m.combine);
    let theoryHours = 0;
    if (theory15) theoryHours = theoryCombined ? (theoryGroups > 0 ? 15 : 0) : (15 * theoryGroups);
    else if (theory30) theoryHours = theoryCombined ? (theoryGroups > 0 ? 30 : 0) : (30 * theoryGroups);
    const labHours = labGroups * 30;
    const computed = theoryHours + labHours;
    if (!computed) {
      const raw = toInt(m.hours ?? m.course?.hours);
      return raw;
    }
    return computed;
  };
  const totalHoursFromContract = (contract) => {
    const arr = Array.isArray(contract?.courses) ? contract.courses : [];
    const year = contract?.academic_year;
    const yearMaps = (year && mappingsByYear?.[year]) ? mappingsByYear[year] : [];
    return arr.reduce((sum, item) => {
      const match = yearMaps.find(m => {
        const mCourseId = normId(m.course?.id ?? m.course_id);
        const mClassId = normId(m.class?.id ?? m.class_id);
        const iCourseId = normId(item.course_id ?? item.course?.id);
        const iClassId = normId(item.class_id ?? item.class?.id);
        const mLecturerId = lecturerUserIdFromMapping(m);
        const cLecturerId = normId(contract?.lecturer_user_id ?? contract?.lecturer?.user_id ?? contract?.lecturer?.id);
        const sameCourseClass = mCourseId && iCourseId && mCourseId === iCourseId && mClassId && iClassId && mClassId === iClassId;
        const sameLecturer = !mLecturerId || !cLecturerId ? true : (mLecturerId === cLecturerId);
        return sameCourseClass && sameLecturer;
      });
      const explicit = toInt(item?.hours);
      if (explicit > 0) return sum + explicit;
      const merged = match ? { ...match, theory_combined: (item?.theory_combined ?? match?.theory_combined) } : item;
      return sum + hoursFromMapping(merged);
    }, 0);
  };
  const formatMDY = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // ...existing state variables...
  const [lecturers, setLecturers] = useState([]);
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [term, setTerm] = useState('1');
  const [yearLevel, setYearLevel] = useState('');
  const [courses, setCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [contractId, setContractId] = useState(null);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listAcademicYear, setListAcademicYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(12); // Adjusted for grid layout
  const [showCreate, setShowCreate] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0, dropUp: false });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, label: '' });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [ratesByLecturer, setRatesByLecturer] = useState({});
  const sentinelRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgLecturerId, setDlgLecturerId] = useState('');
  const [dlgHourlyRate, setDlgHourlyRate] = useState('');
  const [dlgStartDate, setDlgStartDate] = useState('');
  const [dlgEndDate, setDlgEndDate] = useState('');
  const [dlgItemInput, setDlgItemInput] = useState('');
  const [dlgItems, setDlgItems] = useState([]);
  const [dlgErrors, setDlgErrors] = useState({});
  const [dlgSelectedMappingIds, setDlgSelectedMappingIds] = useState(new Set());
  const [dlgCourseQuery, setDlgCourseQuery] = useState('');
  const startRef = useRef(null);
  const endRef = useRef(null);
  const [dlgCombineByMapping, setDlgCombineByMapping] = useState({});
  const [mappingsByYear, setMappingsByYear] = useState({});
  const [profileToUser, setProfileToUser] = useState({});

  // ...existing useMemo, useCallback, and useEffect hooks...
  const currentMenuContract = useMemo(() => {
    return (contracts || []).find(x => x.id === openMenuId) || null;
  }, [contracts, openMenuId]);

  const mappingUserId = useCallback((m) => {
    return normId(
      m?.lecturer_user_id ??
      (m?.lecturer_profile_id != null ? profileToUser[m.lecturer_profile_id] : null) ??
      m?.lecturer?.user_id ??
      m?.user_id ?? null
    );
  }, [profileToUser]);

  const dlgFilteredMappings = useMemo(() => {
    const q = (dlgCourseQuery || '').toLowerCase();
    const list = (mappings || []).filter(m => {
      const st = String(m.status || '').toLowerCase();
      if (st !== 'accepted') return false;
      if (dlgLecturerId) {
        const lid = mappingUserId(m);
        if (normId(dlgLecturerId) !== lid) return false;
      }
      if (!q) return true;
      const cname = m.course?.name?.toLowerCase() || '';
      const ccode = m.course?.code?.toLowerCase() || '';
      const cls = m.class?.name?.toLowerCase() || '';
      const meta = `${m.term || ''} ${m.year_level || ''}`.toLowerCase();
      return cname.includes(q) || ccode.includes(q) || cls.includes(q) || meta.includes(q);
    });
    return list;
  }, [mappings, dlgCourseQuery, dlgLecturerId, mappingUserId]);

  const filteredContracts = useMemo(() => {
    const normalize = (s) => (s || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    const stripTitle = (s) => {
      const titles = '(mr|mrs|ms|miss|dr|prof|professor)';
      return s.replace(new RegExp(`^${titles}\\s+`, 'i'), '').trim();
    };
    const qRaw = normalize(search || '');
    const qName = stripTitle(qRaw);
  // Rely on server-side scoping for admins/management; do not re-filter by department here
  const pool = (contracts || []);
    if (!qName) return pool;
    return pool.filter(c => {
      const lecturerTitle = normalize(c.lecturer?.LecturerProfile?.title || c.lecturer?.title || '');
      const lecturerNameBase = normalize(c.lecturer?.display_name || c.lecturer?.full_name || c.lecturer?.email || '');
      const fullName = `${lecturerTitle ? lecturerTitle + ' ' : ''}${lecturerNameBase}`.trim();
      const candidate = stripTitle(fullName);
      return candidate.startsWith(qName);
    });
  }, [contracts, search, authUser]);

  // ...existing functions...
  const handleCreateContract = async () => {
    const errs = {};
    const today = new Date(); today.setHours(0,0,0,0);
    const sd = dlgStartDate ? new Date(dlgStartDate) : null;
    const ed = dlgEndDate ? new Date(dlgEndDate) : null;
    if (!dlgLecturerId) errs.lecturer = 'Lecturer is required';
    if (!sd) errs.startDate = 'Start Date is required';
    else if (sd < today) errs.startDate = 'Start Date cannot be in the past';
    if (!ed) errs.endDate = 'End Date is required';
    else if (sd && ed <= sd) errs.endDate = 'End Date must be after Start Date';
    if (!dlgItems || dlgItems.length === 0) errs.description = 'Please add at least one duty';
    const selectedMappings = (mappings || []).filter(m => dlgSelectedMappingIds.has(m.id));
    if (selectedMappings.length === 0) errs.courses = 'Please select at least one course to include in this contract.';
    setDlgErrors(errs);
    if (Object.keys(errs).length) return;
    const selectedCoursesPayload = selectedMappings.map(m => {
      const combined = (dlgCombineByMapping?.[m.id] != null) ? !!dlgCombineByMapping[m.id] : toBool(m.theory_combined);
      const hours = hoursFromMapping({ ...m, theory_combined: combined });
      return {
        course_id: m.course?.id,
        class_id: m.class?.id,
        course_name: m.course?.name,
        year_level: m.year_level,
        term: m.term,
        academic_year: m.academic_year,
        theory_combined: combined,
        hours
      };
    });
    try {
      await createDraft({ lecturerId: dlgLecturerId, courses: selectedCoursesPayload, start_date: dlgStartDate, end_date: dlgEndDate, items: dlgItems });
      setDlgOpen(false);
      setDlgItems([]);
      setDlgItemInput('');
    } catch (e) {
      const resp = e?.response;
      const message = resp?.data?.message || 'Failed to create contract';
      const backendErrors = resp?.data?.errors;
      const nextErrs = {};
      if (Array.isArray(backendErrors)) {
        const text = backendErrors.join(', ');
        if (/lecturer_user_id/i.test(text)) nextErrs.lecturer = 'Lecturer is required';
        if (/course/i.test(text)) nextErrs.courses = 'Please select at least one valid course';
        if (/term/i.test(text)) nextErrs.term = 'Term is required';
        if (!Object.keys(nextErrs).length) nextErrs.form = text;
      } else {
        nextErrs.form = message;
      }
      console.error('Create contract failed:', e);
      setDlgErrors(nextErrs);
    }
  };

  // ...existing useEffect hooks...
  useEffect(() => {
    const map = new Map();
    for (const m of (mappings || [])) {
      const st = String(m.status || '').toLowerCase();
      if (st !== 'accepted') continue;
      const uid = mappingUserId(m);
      if (!uid) continue;
      if (!map.has(uid)) {
        map.set(uid, { id: uid, name: lecturerDisplayFromMapping(m) });
      }
    }
    setLecturers(Array.from(map.values()));
  }, [mappings, mappingUserId]);

  useEffect(() => {
    const accepted = (mappings || []).filter(m => String(m.status || '').toLowerCase() === 'accepted');
    const profileIds = Array.from(new Set(accepted.map(m => m.lecturer_profile_id).filter(Boolean)));
    const missing = profileIds.filter(pid => !(pid in profileToUser));
    if (missing.length === 0) return;
    (async () => {
      try {
        let page = 1;
        let totalPages = 1;
        const collected = {};
        do {
          const res = await axiosInstance.get('/lecturers', { params: { page, limit: 100 } });
          const data = res.data?.data || [];
          for (const it of data) {
            if (it?.lecturerProfileId && it?.id) {
              collected[it.lecturerProfileId] = it.id;
            }
          }
          totalPages = res.data?.meta?.totalPages || page;
          const covered = missing.every(pid => (collected[pid] || profileToUser[pid]));
          if (covered) break;
          page += 1;
        } while (page <= totalPages);
        if (Object.keys(collected).length) {
          setProfileToUser(prev => ({ ...prev, ...collected }));
        }
      } catch {
        // ignore mapping failures
      }
    })();
  }, [mappings, profileToUser]);

  useEffect(() => {
    axiosInstance.get('/course-mappings', { params: { academic_year: academicYear, status: 'Accepted', limit: 100 } })
      .then(res => setMappings(res.data?.data || []))
      .catch(()=>{});
  }, [academicYear]);

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

  useEffect(() => {
    const years = Array.from(new Set((contracts || []).map(c => c.academic_year).filter(Boolean)));
    const missing = years.filter(y => !(y in mappingsByYear));
    if (missing.length === 0) return;
    (async () => {
      try {
        const results = await Promise.all(missing.map(async (year) => {
          try {
            const res = await axiosInstance.get('/course-mappings', { params: { academic_year: year, status: 'Accepted', limit: 100 } });
            return [year, res.data?.data || []];
          } catch {
            return [year, []];
          }
        }));
        setMappingsByYear(prev => {
          const next = { ...prev };
          for (const [year, arr] of results) next[year] = arr;
          return next;
        });
      } catch { /* ignore */ }
    })();
  }, [contracts, mappingsByYear]);

  useEffect(() => {
    setPage(1);
    setContracts([]);
    setHasMore(true);
  }, [search, statusFilter, listAcademicYear]);

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
        // ignore batch errors
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

  const formatMoney = (n) => {
    if (n == null) return null;
    try {
      const v = Number(n);
      if (!Number.isFinite(v)) return null;
      return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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
      courses: override.courses || courses,
      items: override.items || dlgItems || []
    };
    const res = await axiosInstance.post('/teaching-contracts', payload);
    setContractId(res.data.id);
    setLastCreatedId(res.data.id);
    setShowCreate(false);
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

  // Build a readable, safe PDF filename based on lecturer title + name (e.g., Dr_Sok_Veasna.pdf)
  const lecturerFilename = (lecturer) => {
    if (!lecturer) return null;
    const rawTitle = lecturer?.LecturerProfile?.title || lecturer?.title || '';
    let base = lecturer?.display_name || lecturer?.full_name || lecturer?.full_name_english || lecturer?.full_name_khmer || lecturer?.name || lecturer?.email || '';
    if (base.includes('@')) base = base.split('@')[0];
    const norm = (s='') => String(s).toLowerCase().replace(/[\.]/g, '').trim();
    const t = norm(rawTitle);
    const prettyTitle = t === 'dr' ? 'Dr' : t === 'prof' || t === 'professor' ? 'Prof' : t === 'mr' ? 'Mr' : t === 'ms' || t === 'miss' ? 'Ms' : t === 'mrs' ? 'Mrs' : (rawTitle ? rawTitle : '');
    const parts = [];
    if (prettyTitle) parts.push(String(prettyTitle).replace(/[\.]/g, ''));
    if (base) parts.push(String(base));
    let combined = parts.join(' ').trim();
    // Sanitize and convert spaces to underscores
    combined = combined.replace(/[\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[\.]/g, '')
      .trim()
      .replace(/\s/g, '_')
      .replace(/_+/g, '_');
    if (!combined) return null;
    return `${combined}.pdf`;
  };

  const downloadPdfFor = async (input) => {
    if (!input) return;
    const c = (typeof input === 'object' && input) ? input : (contracts || []).find(x => x.id === input);
    const id = (typeof input === 'object' && input) ? input.id : input;
    if (!id) return;
    let filename = (c && c.lecturer) ? lecturerFilename(c.lecturer) : null;
    if (!filename) filename = `contract-${id}.pdf`;
    try {
      const res = await axiosInstance.get(`/teaching-contracts/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore download errors
    }
  };

  const deleteContract = async (id) => {
    if (!id) return { ok: false, message: 'Invalid id' };
    try {
      await axiosInstance.delete(`/teaching-contracts/${id}`);
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

  const openMenu = (id, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 168;
    const gap = 8;
    const shouldDropUp = (rect.bottom + menuHeight + gap) > window.innerHeight;
    const dropUp = shouldDropUp;
    const y = dropUp
      ? Math.max(rect.top - menuHeight - gap, gap)
      : Math.min(rect.bottom + gap, Math.max(window.innerHeight - menuHeight - gap, gap));
    const width = 176;
    const rawX = rect.right - width;
    const x = Math.min(Math.max(rawX, gap), Math.max(window.innerWidth - width - gap, gap));
    setMenuCoords({ x, y, dropUp });
    setOpenMenuId(id);
  };
  
  const closeMenu = () => setOpenMenuId(null);

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
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-3 mb-2 min-w-0">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl leading-tight font-bold text-gray-900">Contract Management</h1>
              <p className="text-gray-600 mt-1">Generate and manage lecturer contracts</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button onClick={() => setDlgOpen(true)} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl">
              <Plus className="h-4 w-4 mr-2" /> Generate Contract
            </Button>
          </div>
        </div>
      </div>

      {/* Generate New Contract Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Generate New Contract</DialogTitle>
            <DialogDescription>Fill in the details below to generate a new contract.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 max-h-[70vh] overflow-y-auto">
            {dlgErrors.form && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
                {dlgErrors.form}
              </div>
            )}
            {/* Academic Year */}
            <div className="space-y-1 mb-4">
              <label className="block text-sm font-medium">Academic Year</label>
              <Input className="w-full cursor-pointer h-11 text-base shadow-sm" value={academicYear} onChange={e=>setAcademicYear(e.target.value)} />
              <p className="text-xs text-gray-500">Lecturers are sourced from Accepted course mappings of this year.</p>
            </div>
            {/* Lecturer Information */}
            <div className="space-y-1 mb-4">
              <label className="block text-sm font-medium">Lecturer Name <span className="text-red-600">*</span></label>
              <Select className="w-full cursor-pointer" value={dlgLecturerId} onValueChange={async (val)=>{
                setDlgLecturerId(val);
                setDlgErrors(prev=>({ ...prev, lecturer: '' }));
                setDlgSelectedMappingIds(new Set());
                setDlgCombineByMapping({});
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
              {!lecturers.length && (
                <p className="text-xs text-amber-600">No lecturers found. Try selecting another academic year or ensure Accepted course mappings exist.</p>
              )}
              {dlgErrors.lecturer && <p className="text-xs text-red-600">{dlgErrors.lecturer}</p>}
            </div>

            {/* Contract Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium">Hourly Rate ($)</label>
                <Input className="w-full cursor-pointer h-11 text-base shadow-sm" value={dlgHourlyRate} readOnly />
                {dlgErrors.hourlyRate && <p className="text-xs text-red-600">{dlgErrors.hourlyRate}</p>}
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium">Start Date <span className="text-red-600">*</span></label>
                <div className="relative group">
                  <Input ref={startRef} className="w-full cursor-pointer h-11 text-base pr-10 shadow-sm sm:min-w-[220px]" type="date" value={dlgStartDate} min={new Date().toISOString().slice(0,10)} onChange={e=>{ setDlgStartDate(e.target.value); setDlgErrors(prev=>({ ...prev, startDate: '' })); }}/>
                  <button type="button" aria-label="Pick start date" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30" onClick={()=>{ try { startRef.current?.showPicker?.(); } catch { startRef.current?.focus?.(); } }}>
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
                {dlgErrors.startDate && <p className="text-xs text-red-600">{dlgErrors.startDate}</p>}
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium">End Date <span className="text-red-600">*</span></label>
                <div className="relative group">
                  <Input ref={endRef} className="w-full cursor-pointer h-11 text-base pr-10 shadow-sm sm:min-w-[220px]" type="date" value={dlgEndDate} min={dlgStartDate || new Date().toISOString().slice(0,10)} onChange={e=>{ setDlgEndDate(e.target.value); setDlgErrors(prev=>({ ...prev, endDate: '' })); }}/>
                  <button type="button" aria-label="Pick end date" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30" onClick={()=>{ try { endRef.current?.showPicker?.(); } catch { endRef.current?.focus?.(); } }}>
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
                {dlgErrors.endDate && <p className="text-xs text-red-600">{dlgErrors.endDate}</p>}
              </div>
            </div>

            {/* Itemized list */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Duties (press Enter to add) <span className="text-red-600">*</span></label>
              <Input
                className="w-full cursor-pointer"
                value={dlgItemInput}
                onChange={e => { setDlgItemInput(e.target.value); if (dlgErrors.description) setDlgErrors(prev=>({ ...prev, description: '' })); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = (dlgItemInput || '').trim();
                    if (v) {
                      setDlgItems(prev => [...prev, v]);
                      setDlgItemInput('');
                    }
                  }
                }}
                placeholder="Type a duty and press Enter"
              />
              {dlgItems.length > 0 && (
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  {dlgItems.map((it, idx) => (
                    <li key={`${it}-${idx}`} className="flex items-start gap-2">
                      <span className="flex-1">{it}</span>
                      <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => {
                        setDlgItems(prev => prev.filter((_, i) => i !== idx));
                      }}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              {dlgErrors.description && <div className="text-xs text-red-600">{dlgErrors.description}</div>}
            </div>

            {/* Courses selection */}
            <div className="mt-5">
              <label className="block text-sm font-medium mb-1">Courses to include <span className="text-red-600">*</span></label>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input className="w-full pl-9" placeholder="Search by course name/code or class…" value={dlgCourseQuery} onChange={e=>setDlgCourseQuery(e.target.value)} />
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
                    const typeHoursStr = String(m.type_hours || '');
                    const th = String(m.theory_hours || '').toLowerCase();
                    const theory15 = th === '15h' || (!th && /15h/i.test(typeHoursStr));
                    const theory30 = th === '30h' || (!th && /30h/i.test(typeHoursStr));
                    const theoryGroups = Number(m.theory_groups ?? m.groups_15h ?? m.groups_theory ?? m.group_count_theory ?? 0) || 0;
                    const canCombineTheory = (theory15 || theory30) && theoryGroups > 1;
                    const combined = canCombineTheory ? !!(dlgCombineByMapping[m.id] ?? m.theory_combined) : false;
                    const computedHours = hoursFromMapping({ ...m, theory_combined: combined });
                    const rateNum = (() => { try { const raw = dlgHourlyRate; const n = raw != null ? parseFloat(String(raw).replace(/[^0-9.\-]/g, '')) : NaN; return Number.isFinite(n) ? n : null; } catch { return null; } })();
                    const estSalary = rateNum != null ? Math.round(rateNum * (computedHours || 0)) : null;
                    return (
                      <div key={m.id} className="p-3 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <Checkbox id={`map-${m.id}`} checked={checked} onCheckedChange={() => {
                            const next = new Set(Array.from(dlgSelectedMappingIds));
                            if (checked) next.delete(m.id); else next.add(m.id);
                            setDlgSelectedMappingIds(next);
                            setDlgErrors(prev=>({ ...prev, courses: '' }));
                          }} />
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-gray-900">
                              {m.course?.name} <span className="text-gray-500 font-normal">({computedHours || '-'}h)</span>
                            </div>
                            <div className="text-xs text-gray-600">{m.class?.name || 'Class'} • Year {m.year_level} • Term {m.term} • {m.academic_year}</div>
                            {canCombineTheory && (
                              <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                                <Checkbox checked={combined} onCheckedChange={(v)=> setDlgCombineByMapping(prev => ({ ...prev, [m.id]: !!v }))} />
                                Combine groups into 1 class<span className="text-gray-500">({theory15 ? '15h' : '30h'})</span>
                              </label>
                            )}
                            {estSalary != null && (
                              <div className="mt-1 text-xs text-gray-600">Est. salary: {estSalary.toLocaleString('en-US')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {dlgErrors.courses && <p className="text-xs text-red-600 mt-1">{dlgErrors.courses}</p>}
            </div>
          </div>
          <div className="px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" className="w-full sm:w-auto cursor-pointer" onClick={()=> setDlgOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto cursor-pointer" onClick={handleCreateContract}>Generate Contract</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create form card (legacy) */}
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

      {/* Search & filter bar */}
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <Input className="w-full pl-9 rounded-xl" placeholder="Search lecturer name without title" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
    <div className="w-full md:w-auto md:min-w-[160px]">
          <Select value={statusFilter} onValueChange={v=>{ setStatusFilter(v); setPage(1); }} placeholder="All Status">
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="WAITING_MANAGEMENT">Waiting Management</SelectItem>
            <SelectItem value="WAITING_LECTURER">Waiting Lecturer</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </Select>
        </div>
      </div>

      {/* Contracts Grid */}
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600"/>
            <h2 className="text-lg font-semibold">Contracts ({total})</h2>
          </div>
          <div className="text-sm text-gray-600">{(contracts?.length||0)} of {total} shown</div>
        </div>

        {/* Contract Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Loading skeletons */}
          {(loading && contracts.length === 0 && !search) && Array.from({ length: 8 }).map((_, i) => (
            <div key={`sk-${i}`} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="h-4 w-24 bg-gray-200 rounded"/>
                <div className="h-6 w-6 bg-gray-200 rounded"/>
              </div>
              <div className="space-y-2">
                <div className="h-5 w-32 bg-gray-200 rounded"/>
                <div className="h-3 w-40 bg-gray-100 rounded"/>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 bg-gray-200 rounded"/>
                <div className="h-4 w-20 bg-gray-200 rounded"/>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="h-5 w-20 bg-gray-100 rounded-full"/>
                <div className="h-8 w-8 bg-gray-100 rounded"/>
              </div>
            </div>
          ))}

          {/* Contract Cards */}
          {(filteredContracts || []).map(c => {
            const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
            const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
            const hours = totalHoursFromContract(c);
            const rate = ratesByLecturer[c.lecturer_user_id];
            const salary = (Number.isFinite(Number(rate)) && Number.isFinite(Number(hours)))
              ? Number(rate) * Number(hours)
              : null;
            const startDate = c.start_date || c.startDate || c.start || null;
            const endDate = c.end_date || c.endDate || c.end || null;
            const hasBothDates = !!(startDate && endDate);
            const hasAnyDate = !!(startDate || endDate);
            const period = `Term ${c.term} • ${c.academic_year}`;
            // Prefer department from the course include (server-scoped), fallback to lecturer's department
            const dept = (c.courses && c.courses[0] && c.courses[0].Course && c.courses[0].Course.Department && c.courses[0].Course.Department.dept_name)
              || c.lecturer?.department_name || 'N/A';
            const lecturerTitle = c.lecturer?.LecturerProfile?.title || c.lecturer?.title || '';
            const lecturerNameBase = c.lecturer?.display_name || c.lecturer?.full_name || c.lecturer?.email;
            const lecturerName = `${lecturerTitle ? lecturerTitle + '. ' : ''}${lecturerNameBase || ''}`.trim();
            const statusMap = {
              WAITING_MANAGEMENT: { label: 'Waiting Management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
              WAITING_LECTURER: { label: 'Waiting Lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
              MANAGEMENT_SIGNED: { label: 'Waiting Lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
              LECTURER_SIGNED: { label: 'Waiting Management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
              COMPLETED: { label: 'Completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
            };
            const st = statusMap[c.status] || { label: String(c.status||'').toLowerCase(), class: 'bg-gray-100 text-gray-700 border-gray-200' };

            return (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 p-4 group">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-900 text-sm">{formattedId}</span>
                  </div>
                  <div className="contract-action-menu">
                    <button
                      type="button"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-opacity"
                      onClick={(e) => openMenu(c.id, e)}
                      aria-label="Open actions"
                    >
                      <Ellipsis className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Lecturer Info */}
                <div className="mb-4">
                  <div className="flex items-start gap-2 mb-1">
                    <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 text-sm truncate" title={lecturerName}>
                        {lecturerName}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={c.lecturer?.email}>
                        {c.lecturer?.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{dept}</span>
                  </div>
                </div>

                {/* Period */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                    <Calendar className="w-3 h-3 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Contract Period</span>
                  </div>
                  {hasBothDates ? (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{formatMDY(startDate)}</div>
                      <div className="text-gray-600">to {formatMDY(endDate)}</div>
                    </div>
                  ) : hasAnyDate ? (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{formatMDY(startDate || endDate)}</div>
                      <div className="text-gray-600">{period}</div>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-gray-900">{period}</div>
                  )}
                </div>

                {/* Financial Info */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                    <DollarSign className="w-3 h-3 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Financial Details</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Rate:</span>
                      <span className="font-medium text-gray-900">{formatRate(rate) ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hours:</span>
                      <span className="font-medium text-gray-900">{hours}h</span>
                    </div>
                    {salary != null && (
                      <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold text-green-700">{formatMoney(salary)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border ${st.class}`}>
                    {st.icon ? React.createElement(st.icon, { className: 'w-3 h-3' }) : null}
                    {st.label}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => previewPdfFor(c.id)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      title="View Contract"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadPdfFor(c.id)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {(!loading && (filteredContracts || []).length === 0) && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
              <p className="text-gray-500 mb-4">
                {search ? 'Try adjusting your search criteria' : 'Get started by generating your first contract'}
              </p>
              {!search && (
                <Button onClick={() => setDlgOpen(true)} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Generate Contract
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="flex justify-center items-center py-8 text-sm text-gray-500">
          {loading && contracts.length > 0 && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading more contracts...
            </div>
          )}
          {!loading && hasMore && 'Scroll to load more'}
          {!loading && !hasMore && contracts.length > 0 && 'All contracts loaded'}
        </div>
      </div>

      {/* Floating actions menu (portal) */}
      {openMenuId && ReactDOM.createPortal(
        <div className="fixed z-50 contract-action-menu" style={{ top: menuCoords.y, left: menuCoords.x }}>
          <div className="w-44 bg-white border border-gray-200 rounded-md shadow-lg py-2 text-sm">
            <button onClick={() => { previewPdfFor(openMenuId); closeMenu(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"><Eye className="w-4 h-4"/> View Contract</button>
            <button onClick={() => { downloadPdfFor(openMenuId); closeMenu(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"><Download className="w-4 h-4"/> Download PDF</button>
            {currentMenuContract && currentMenuContract.status !== 'COMPLETED' && (
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