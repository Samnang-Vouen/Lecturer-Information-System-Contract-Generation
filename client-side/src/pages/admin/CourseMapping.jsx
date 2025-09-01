import React, { useEffect, useMemo, useState, useRef } from 'react';
// NOTE: XLSX is dynamically imported on demand to reduce Vite optimize pressure
import axiosInstance from '../../lib/axios.js';
import { Plus, Edit, Users, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { useAuthStore } from '../../store/useAuthStore.js';

// Minimal local UI wrappers reusing existing components (assumed available in project)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog.jsx';

// NOTE: If some of these UI components differ in naming, adjust imports accordingly.

export default function CourseMappingPage() {
  // Use authUser (consistent with rest of app) instead of non-existent user field
  const { authUser } = useAuthStore();
  const [classes, setClasses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [academicYearFilter, setAcademicYearFilter] = useState('ALL');
  const [termFilter, setTermFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Quick lookup maps
  const classMap = useMemo(()=> Object.fromEntries((Array.isArray(classes)?classes:[]).map(c=> [c.id, c])), [classes]);
  const courseMap = useMemo(()=> Object.fromEntries((Array.isArray(courses)?courses:[]).map(c=> [c.id, c])), [courses]);

  // Build preview rows (first 20) matching official export columns
  const previewRows = useMemo(() => {
    const rows = (Array.isArray(mappings) ? mappings : []).slice(0, 20);
    return rows.map((r, idx) => {
      const cls = r.class;
      const crs = r.course || courseMap[r.course_id] || {};
      const subject = crs.name || crs.course_name || '';
      const hours = crs.hours ?? '';
      const credits = crs.credits ?? '';
      const totalClass = cls?.total_class ?? '';
      const lecturerName = r.lecturer?.name || '';
      const group = r.group_count ?? '';
      const type = (r.type_hours || '').toLowerCase();
      const theory = (type.includes('theory') || type.includes('15h')) ? 1 : '';
      const lab = (type.includes('lab') || type.includes('30h')) ? 1 : '';
      const only15h = /only\s*15h/i.test(r.type_hours || '') ? 1 : '';
      const only30h = /only\s*30h/i.test(r.type_hours || '') ? 1 : '';
      const status = r.status || '';
      const availability = r.availability || '';
      const survey = '';
      const contactedBy = r.contacted_by || '';
      const comments = r.comment || '';
      return { no: idx + 1, subject, hour: hours, credit: credits, total_class: totalClass, lecturers: lecturerName, group, theory, lab, only15h, only30h, status, availability, survey, contactedBy, comments };
    });
  }, [mappings, courseMap]);

  const [form, setForm] = useState({
    class_id: '',
    course_id: '',
    lecturer_profile_id: '',
    academic_year: '',
    term: '',
    year_level: '',
    group_count: 1,
    type_hours: 'Theory (15h)',
    availability: '',
    status: 'Pending',
    contacted_by: '',
  contactedBy: '',
    comment: ''
  });

  // (no simple filter inputs required - native selects used)

  const loadData = async (reset=false) => {
    try {
      setLoading(true); setError(null);
      const baseParams = { page:1, limit:200 };
      const [clsRes, lectRes, courseRes] = await Promise.all([
        axiosInstance.get('/classes', { params: baseParams }),
        axiosInstance.get('/lecturers', { params: baseParams }),
        axiosInstance.get('/courses', { params: { page:1, limit:500 } })
      ]);
      const clsPayload = clsRes.data;
      const classList = Array.isArray(clsPayload) ? clsPayload : (Array.isArray(clsPayload?.data) ? clsPayload.data : []);
      setClasses(classList);
  // Keep lecturer's attached courses so UI can filter by selected course
  setLecturers((lectRes.data?.data || []).map(l=> ({ id: l.lecturerProfileId, name: l.name, courses: l.courses || [] })) );
      const coursePayload = courseRes.data;
      const courseList = Array.isArray(coursePayload) ? coursePayload : (Array.isArray(coursePayload?.data) ? coursePayload.data : []);
      setCourses(courseList);
      // Load first page (or reset) of mappings separately to simplify infinite scroll
      if (reset) {
        setPage(1);
      }
      const firstPage = reset ? 1 : page;
      const mapRes = await axiosInstance.get('/course-mappings', { params: {
        page: firstPage,
        limit: 10,
        ...(academicYearFilter && academicYearFilter !== 'ALL' ? { academic_year: academicYearFilter } : {})
      }});
      const mData = Array.isArray(mapRes.data) ? mapRes.data : (Array.isArray(mapRes.data?.data) ? mapRes.data.data : []);
      setMappings(reset ? mData : [...mappings, ...mData]);
      setHasMore(!!mapRes.data?.hasMore);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };
  // Initial & academic year change (reset)
  useEffect(()=> { loadData(true); }, [academicYearFilter]);

  // Infinite scroll observer
  useEffect(()=> {
    if (!hasMore || loading) return; // don't observe when no more or loading
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        // load next page
        (async () => {
          try {
            setLoading(true); setError(null);
            const nextPage = page + 1;
            const mapRes = await axiosInstance.get('/course-mappings', { params: {
              page: nextPage,
              limit: 10,
              ...(academicYearFilter && academicYearFilter !== 'ALL' ? { academic_year: academicYearFilter } : {})
            }});
            const mData = Array.isArray(mapRes.data) ? mapRes.data : (Array.isArray(mapRes.data?.data) ? mapRes.data.data : []);
            setMappings(prev => [...prev, ...mData]);
            setPage(nextPage);
            setHasMore(!!mapRes.data?.hasMore);
          } catch(e){
            setError(e.response?.data?.message || e.message);
          } finally { setLoading(false); }
        })();
      }
    }, { threshold: 1.0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, academicYearFilter]);

  

  // Cascading option sets for the Add dialog (derived from classes)
  const yearLevelOptionsForAY = useMemo(() => {
    if (!form.academic_year) return [];
    const set = new Set();
    (Array.isArray(classes) ? classes : []).forEach(c => {
      if (String(c.academic_year) === String(form.academic_year) && (c.year_level || c.yearLevel)) {
        set.add(String(c.year_level ?? c.yearLevel));
      }
    });
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [classes, form.academic_year]);

  const termOptionsForAYLevel = useMemo(() => {
    if (!form.academic_year || !form.year_level) return [];
    const set = new Set();
    (Array.isArray(classes) ? classes : []).forEach(c => {
      const yl = c.year_level ?? c.yearLevel;
      if (String(c.academic_year) === String(form.academic_year) && String(yl) === String(form.year_level) && c.term) {
        set.add(String(c.term));
      }
    });
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [classes, form.academic_year, form.year_level]);

  const classesForSelection = useMemo(() => {
    if (!form.academic_year || !form.year_level || !form.term) return [];
    return (Array.isArray(classes) ? classes : []).filter(c =>
      String(c.academic_year) === String(form.academic_year) &&
      String((c.year_level ?? c.yearLevel)) === String(form.year_level) &&
      String(c.term) === String(form.term)
    );
  }, [classes, form.academic_year, form.year_level, form.term]);

  // Reload source data when Academic Year is chosen (server may filter by academic_year; if not, we still filter client-side)
  const reloadForAcademicYear = async (year) => {
    try {
      setLoading(true); setError(null);
      const paramsCommon = { page:1, limit:500, ...(year ? { academic_year: year } : {}) };
      const [clsRes, lectRes, courseRes] = await Promise.all([
        axiosInstance.get('/classes', { params: paramsCommon }),
        axiosInstance.get('/lecturers', { params: paramsCommon }),
        axiosInstance.get('/courses', { params: paramsCommon })
      ]);
      const clsPayload = clsRes.data;
      const classList = Array.isArray(clsPayload) ? clsPayload : (Array.isArray(clsPayload?.data) ? clsPayload.data : []);
      setClasses(classList);
      setLecturers((lectRes.data?.data || []).map(l=> ({ id: l.lecturerProfileId, name: l.name, courses: l.courses || [] })) );
      const coursePayload = courseRes.data;
      const courseList = Array.isArray(coursePayload) ? coursePayload : (Array.isArray(coursePayload?.data) ? coursePayload.data : []);
      setCourses(courseList);
    } catch(e) {
      // Non-fatal: keep existing data and rely on client-side filtering
      console.error('reloadForAcademicYear failed', e);
    } finally { setLoading(false); }
  };

  const grouped = useMemo(()=> {
    const by = {};
    (Array.isArray(mappings)?mappings:[]).forEach(m => {
      const key = `${String(m.class?.id || m.class_id || 'unknown')}-${String(m.term || '')}-${String(m.academic_year || '')}`;
      if (!by[key]) by[key] = { key, class: m.class, entries: [], stats: { total:0, assigned:0, pending:0, hoursAssigned:0, hoursNeeded:0 } };
      by[key].entries.push(m);
    });
    // Apply entry-level filters (term & status) then rebuild stats
    const filteredGroups = [];
    Object.values(by).forEach(group => {
      let entries = group.entries;
      if(termFilter !== 'ALL') entries = entries.filter(e => (e.term || '') === termFilter);
      if(statusFilter !== 'ALL') entries = entries.filter(e => (e.status || '') === statusFilter);
      if(academicYearFilter !== 'ALL') entries = entries.filter(e => (e.academic_year || '') === academicYearFilter);
      if(!entries.length) return; // skip empty group after filters
      const stats = {
        total: entries.length,
        pending: entries.filter(e=> e.status==='Pending').length,
        assigned: entries.filter(e=> e.status==='Accepted' && e.lecturer_profile_id).length,
        hoursAssigned: entries.filter(e=> e.status==='Accepted').reduce((sum,e)=> {
          const h = e.type_hours?.includes('15h') ? 15 : 30; return sum + h * (e.group_count||1);
        },0),
        hoursNeeded: entries.reduce((sum,e)=> sum + 15*(e.group_count||1),0)
      };
      filteredGroups.push({ ...group, entries, stats });
    });
    return filteredGroups.sort((a,b)=> ( (b.class?.academic_year||'') ).localeCompare(a.class?.academic_year||'') || (a.class?.name||'').localeCompare(b.class?.name||''));
  }, [mappings, academicYearFilter, termFilter, statusFilter]);

  const academicYearOptions = useMemo(()=> {
    const set = new Set();
    (Array.isArray(classes)?classes:[]).forEach(c=> { if (c.academic_year) set.add(String(c.academic_year)); });
    (Array.isArray(mappings)?mappings:[]).forEach(m=> { if (m.academic_year) set.add(String(m.academic_year)); });
    return Array.from(set).sort();
  }, [classes, mappings]);

  const termOptions = useMemo(()=> {
    const set = new Set();
    (Array.isArray(classes)?classes:[]).forEach(c=> { if(c.term) set.add(String(c.term)); });
    (Array.isArray(mappings)?mappings:[]).forEach(m=> { if(m.term) set.add(String(m.term)); });
    return Array.from(set).sort();
  }, [classes, mappings]);
  const statusOptions = ['Pending','Contacting','Accepted','Rejected'];

  // Availability day options (Mon-Fri) and helpers
  const DAY_OPTIONS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const selectedAvailabilityDays = useMemo(() => {
    const set = new Set();
    (form.availability || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(d => {
        const dLower = d.toLowerCase();
        const match = DAY_OPTIONS.find(opt => opt.toLowerCase() === dLower || opt.toLowerCase().startsWith(dLower) || dLower.startsWith(opt.toLowerCase()));
        if (match) set.add(match);
      });
    return set;
  }, [form.availability]);

  const toggleAvailabilityDay = (day) => {
    setForm(f => {
      const set = new Set();
      (f.availability || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(d => {
          const dLower = d.toLowerCase();
          const match = DAY_OPTIONS.find(opt => opt.toLowerCase() === dLower || opt.toLowerCase().startsWith(dLower) || dLower.startsWith(opt.toLowerCase()));
          if (match) set.add(match);
        });
      if (set.has(day)) set.delete(day); else set.add(day);
      return { ...f, availability: Array.from(set).join(', ') };
    });
  };

  const startAdd = () => { setForm({ ...form, class_id:'', course_id:'', lecturer_profile_id:'', academic_year:'', term:'', year_level:'', group_count:1, type_hours:'Theory (15h)', availability:'', status:'Pending', contacted_by:authUser?.fullName || authUser?.name || '', contactedBy:authUser?.fullName || authUser?.name || '', comment:'' }); setAddOpen(true); };

  const submitAdd = async () => {
    try {
      const payload = {
        ...form,
        course_id: form.course_id ? parseInt(form.course_id, 10) : '',
  group_count: Math.max(1, parseInt(form.group_count, 10) || 1),
  comment: (form.comment || '').slice(0, 160)
      };
  // Normalize contacted_by for API, prefer new camelCase field
  payload.contacted_by = form.contactedBy || form.contacted_by || '';
  delete payload.contactedBy;
      if (!payload.academic_year || !payload.year_level || !payload.term || !payload.class_id || !payload.course_id) return;
      await axiosInstance.post('/course-mappings', payload);
  setAddOpen(false); loadData(true);
    } catch (e) { setError(e.response?.data?.message || e.message); }
  };

  const startEdit = (m) => { setEditing(m); setForm({
    class_id: m.class_id,
    course_id: m.course_id,
    lecturer_profile_id: m.lecturer_profile_id || '',
    academic_year: m.academic_year,
    term: m.term,
    year_level: m.year_level || '',
    group_count: m.group_count || 1,
    type_hours: m.type_hours,
    availability: m.availability || '',
    status: m.status,
    contacted_by: m.contacted_by || '',
    comment: m.comment || ''
  }); setEditOpen(true); };

  const submitEdit = async () => {
    if (!editing) return;
    try {
  const payload = {};
  ['lecturer_profile_id','type_hours','availability','status','contacted_by','comment'].forEach(k=> { payload[k]=form[k]; });
  payload.group_count = Math.max(1, parseInt(form.group_count, 10) || 1);
  payload.comment = (form.comment || '').slice(0, 160);
      await axiosInstance.put(`/course-mappings/${editing.id}`, payload);
      setEditOpen(false); setEditing(null); loadData(true);
    } catch (e) { setError(e.response?.data?.message || e.message); }
  };

  const remove = async (m) => {
    try {
      await axiosInstance.delete(`/course-mappings/${m.id}`);
      await loadData(true);
    } catch(e){
      setError(e.response?.data?.message || e.message);
    }
  };

  return (
    <>
      <div className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Mapping</h1>
            <p className="text-sm text-gray-600 mt-1">Class-based view of lecturer assignments and workload</p>
          </div>
          <Button onClick={startAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 h-11 gap-2 flex items-center shadow-sm">
            <Plus className="h-4 w-4"/> Add Course Assignment
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={()=> setPreviewOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-10"
          >Preview Export</Button>

          <Button
            onClick={async ()=> {
              try {
                setLoading(true); setError(null);
                const params = new URLSearchParams();
                if (academicYearFilter && academicYearFilter !== 'ALL') params.set('academic_year', academicYearFilter);
                // Optional: if you have term dates in UI, include term_start & term_end
                const resp = await axiosInstance.get(`/course-mappings/export?${params.toString()}`, { responseType: 'blob' });
                const blob = new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `CourseMapping_${academicYearFilter && academicYearFilter !== 'ALL' ? academicYearFilter : 'All'}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e.response?.data?.message || e.message);
              } finally { setLoading(false); }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 h-10"
          >Download Official Export</Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter by Academic Year:</label>
            <select
              value={academicYearFilter}
              onChange={e=> setAcademicYearFilter(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Academic Years</option>
              {academicYearOptions.map(y => <option key={`ay-${y}`} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Term:</label>
            <select
              value={termFilter}
              onChange={e=> setTermFilter(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All</option>
              {termOptions.map(t => <option key={`fterm-${t}`} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={e=> setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="text-sm text-gray-500">Showing {grouped.length} class{grouped.length!==1 && 'es'} {academicYearFilter==='ALL' ? 'for all years' : `for ${academicYearFilter}`}</div>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        {/* NOTE: Client-side filters applied: Academic Year, Term, Status */}
        <div className="space-y-8">
          {grouped.map(g => {
            const completion = g.stats.total? Math.round((g.stats.assigned / g.stats.total)*100):0;
            const academicYear = g.class?.academic_year || g.entries[0]?.academic_year;
            return (
              <div key={g.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 pt-5 pb-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-blue-700"><Users className="h-5 w-5"/></div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-gray-900 text-lg">{g.class?.name || 'Class'} {g.class?.term && <span className="text-gray-500 font-normal">{g.class.term}</span>} {g.class?.year_level && <span className="text-gray-500 font-normal">Year {typeof g.class.year_level === 'string' ? (g.class.year_level.replace(/[^0-9]/g,'') || g.class.year_level) : g.class.year_level}</span>}</h2>
                          {academicYear && <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{academicYear}</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {g.stats.assigned} of {g.stats.total} course{g.stats.total!==1 && 's'} assigned • {g.stats.hoursAssigned}h of {g.stats.hoursNeeded}h covered
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {g.stats.pending>0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-50 text-red-700 text-xs font-medium px-2 py-1">
                          <AlertTriangle className="h-3 w-3"/> {g.stats.pending} Pending
                        </span>
                      )}
                      {g.stats.pending===0 && g.stats.total>0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-green-50 text-green-700 text-xs font-medium px-2 py-1">
                          <CheckCircle className="h-3 w-3"/> Complete
                        </span>
                      )}
                      {g.stats.pending>0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white text-xs font-medium px-2 py-1">
                          Needs Attention
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Course Assignment Progress</span>
                      <span>{completion}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-900 transition-all duration-500" style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-200 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                        <th className="py-3 pl-6 pr-3 font-medium">Course</th>
                        <th className="px-3 py-3 font-medium">Lecturer</th>
                        <th className="px-3 py-3 font-medium">Groups</th>
                        <th className="px-3 py-3 font-medium">Hours</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {g.entries.map(m => {
                        const statusColor = m.status==='Accepted'? 'bg-green-100 text-green-700': m.status==='Contacting'? 'bg-blue-100 text-blue-700': m.status==='Rejected'? 'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700';
                        const rowKey = String(m.id ?? `${m.class_id}-${m.course_id}-${m.term}-${m.academic_year}`);
                        return (
                          <tr key={rowKey} className="hover:bg-gray-50">
                            <td className="py-3 pl-6 pr-3 text-gray-900 font-medium whitespace-nowrap">{
                              m.course?.course_name ||
                              courseMap[m.course_id]?.course_name ||
                              m.course?.course_code ||
                              courseMap[m.course_id]?.course_code ||
                              m.course_id
                            }</td>
                            <td className="px-3 py-3 whitespace-nowrap">{m.lecturer?.name || <span className="italic text-gray-400">Not assigned</span>}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{m.group_count || <span className="italic text-gray-400">not yet</span>}</td>
                            <td className="px-3 py-3 whitespace-nowrap">{m.type_hours ? <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{m.type_hours}</span> : <span className="italic text-gray-400">not yet</span>}</td>
                            <td className="px-3 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{m.status}</span></td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={()=> startEdit(m)}
                                  title="Edit"
                                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={()=> { setToDelete(m); setConfirmOpen(true); }}
                                  title="Delete"
                                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-red-300 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors shadow-sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {grouped.length===0 && !loading && <div className="text-sm text-gray-500">No mappings.</div>}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-gray-400">
            {loading ? 'Loading more...' : (hasMore ? 'Scroll to load more (server-side pagination 10 per page)' : 'No more data')}
          </div>
        </div>

      {/* Confirm Delete Dialog */}
      {confirmOpen && toDelete && (
        <Dialog open={confirmOpen} onOpenChange={(open)=> { setConfirmOpen(open); if (!open) setToDelete(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="px-2 pb-2 text-center space-y-4">
              <p className="text-sm text-gray-700">
                Do you want to delete this {toDelete?.course?.course_name || courseMap[toDelete?.course_id]?.course_name || toDelete?.course?.course_code || courseMap[toDelete?.course_id]?.course_code || toDelete?.course_id}?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                <Button
                  onClick={async ()=> {
                    if (!toDelete) return;
                    try {
                      setDeleting(true);
                      await remove(toDelete);
                      setConfirmOpen(false);
                      setToDelete(null);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[120px]"
                  disabled={deleting}
                >{deleting ? 'Deleting…' : 'OK'}</Button>
                <Button
                  variant="outline"
                  onClick={()=> { setConfirmOpen(false); setToDelete(null); }}
                  className="sm:min-w-[120px]"
                  disabled={deleting}
                >Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {addOpen && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>New Mapping</DialogTitle></DialogHeader>
              <div className="max-h-[80vh] sm:max-h-[70vh] overflow-y-auto px-2">
                <div className="w-full max-w-2xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-min text-sm">
              {/* 1) Academic Year */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingAcademicYear" className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <select
                  id="newMappingAcademicYear"
                  name="academic_year"
                  value={form.academic_year}
                  onChange={async e=> {
                    const year = e.target.value;
                    setForm(f=> ({ ...f, academic_year: year, year_level:'', term:'', class_id:'', course_id:'', lecturer_profile_id:'' }));
                    if (year) await reloadForAcademicYear(year);
                  }}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select academic year</option>
                  {academicYearOptions.map(y => <option key={`ay-${y}`} value={y}>{y}</option>)}
                </select>
              </div>
              {/* 2) Year Level */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingYearLevel" className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <select
                  id="newMappingYearLevel"
                  name="year_level"
                  value={form.year_level}
                  onChange={e=> setForm(f=> ({ ...f, year_level: e.target.value, term:'', class_id:'', course_id:'', lecturer_profile_id:'' }))}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!form.academic_year}
                >
                  <option value="">{form.academic_year ? 'Select year level' : 'Select academic year first'}</option>
                  {yearLevelOptionsForAY.map(y => <option key={`yl-${y}`} value={y}>{String(y).startsWith('Year ') ? y : `Year ${y}`}</option>)}
                </select>
              </div>
              {/* 3) Term */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingTerm" className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  id="newMappingTerm"
                  name="term"
                  value={form.term}
                  onChange={e=> setForm(f=> ({ ...f, term: e.target.value, class_id:'', course_id:'', lecturer_profile_id:'' }))}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!form.academic_year || !form.year_level}
                >
                  <option value="">{form.year_level ? 'Select term' : (form.academic_year ? 'Select year level first' : 'Select academic year first')}</option>
                  {termOptionsForAYLevel.map(t => <option key={`term-${t}`} value={t}>{t}</option>)}
                </select>
              </div>
              {/* 4) Class */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingClass" className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  id="newMappingClass"
                  name="class_id"
                  value={form.class_id}
                  onChange={e=> {
                    const val = e.target.value;
                    const c = classMap[val];
                    setForm(f=> ({
                      ...f,
                      class_id: val,
                      term: f.term || c?.term || '',
                      year_level: f.year_level || c?.year_level || '',
                      academic_year: f.academic_year || c?.academic_year || '',
                      course_id: '',
                      lecturer_profile_id: ''
                    }));
                  }}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!form.academic_year || !form.year_level || !form.term}
                >
                  <option value="">{form.term ? 'Select class' : (form.year_level ? 'Select term first' : (form.academic_year ? 'Select year level first' : 'Select academic year first'))}</option>
                  {classesForSelection.map(c=> (
                    <option key={c.id} value={c.id}>{c.name}{c.term? ' ' + c.term: ''}</option>
                  ))}
                </select>
              </div>
              {/* 5) Course */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingCourse" className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  id="newMappingCourse"
                  name="course_id"
                  value={form.course_id}
                  onChange={e=> setForm(f=> ({ ...f, course_id: e.target.value, lecturer_profile_id:'' }))}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!form.class_id}
                >
                  <option value="">{form.class_id ? 'Select course' : 'Select class first'}</option>
                  {(() => {
                    const cls = classes.find(c=> c.id==form.class_id);
                    let allowed = courses;
                    if (cls && Array.isArray(cls.courses) && cls.courses.length) {
                      const codes = new Set(cls.courses.map(x => (typeof x === 'string') ? x : (x.course_code || x.code || x.courseCode || null)).filter(Boolean));
                      if (codes.size) allowed = courses.filter(c=> codes.has(c.course_code));
                    }
                    return allowed.map(c=> (
                      <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
                    ));
                  })()}
                </select>
              </div>
              {/* 6) Lecturer */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingLecturer" className="block text-sm font-medium text-gray-700 mb-1">Lecturer</label>
                <select id="newMappingLecturer" name="lecturer_profile_id" value={form.lecturer_profile_id} onChange={e=> setForm(f=> ({ ...f, lecturer_profile_id:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={!form.course_id}>
                  <option value="">Unassigned</option>
                  {(() => {
                    const filtered = form.course_id ? lecturers.filter(l => Array.isArray(l.courses) && l.courses.some(cc => String(cc.id) === String(form.course_id) || String(cc.course_code) === String((courseMap[form.course_id]?.course_code || '')))) : [];
                    if (!filtered.length) return <option value="" disabled>No lecturers for selected course</option>;
                    return filtered.map(l=> <option key={l.id} value={l.id}>{l.name}</option>);
                  })()}
                </select>
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingGroups" className="block text-sm font-medium text-gray-700 mb-1">Groups</label>
                <input
                  id="newMappingGroups"
                  name="group_count"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  value={form.group_count}
                  onChange={e=> {
                    const val = e.target.value;
                    // allow empty while typing; coerce later on blur/submit
                    setForm(f=> ({ ...f, group_count: val }));
                  }}
                  onBlur={e=> {
                    const v = parseInt(e.target.value, 10);
                    setForm(f=> ({ ...f, group_count: (isNaN(v) || v < 1) ? 1 : v }));
                  }}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingTypeHours" className="block text-sm font-medium text-gray-700 mb-1">Type & Hours</label>
                <select id="newMappingTypeHours" name="type_hours" value={form.type_hours} onChange={e=> setForm(f=> ({ ...f, type_hours:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Theory (15h)</option>
                  <option>Lab (30h)</option>
                  <option>Only 15h</option>
                  <option>Only 30h</option>
                </select>
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingAvailability" className="block text-sm font-medium text-gray-700 mb-1">Availability (days)</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map(day => {
                    const active = selectedAvailabilityDays.has(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleAvailabilityDay(day)}
                        className={`min-w-[44px] px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        aria-pressed={active}
                      >{day.slice(0,3)}</button>
                    );
                  })}
                </div>
                <input id="newMappingAvailability" name="availability" value={form.availability} onChange={e=> setForm(f=> ({ ...f, availability:e.target.value }))} className="sr-only" readOnly />
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="newMappingStatus" name="status" value={form.status} onChange={e=> setForm(f=> ({ ...f, status:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Pending</option>
                  <option>Contacting</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </div>
              {/* Contacted By */}
              <div className="col-span-1 sm:col-span-2 flex flex-col">
                <label htmlFor="newMappingContactedBy" className="block text-sm font-medium text-gray-700 mb-1">Contacted By</label>
                <input
                  id="newMappingContactedBy"
                  name="newMappingContactedBy"
                  value={form.contactedBy}
                  onChange={e=> setForm(f=> ({ ...f, contactedBy: e.target.value }))}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mr. John Smith"
                />
              </div>
              <div className="col-span-1 sm:col-span-2 flex flex-col">
                <label htmlFor="newMappingComment" className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  id="newMappingComment"
                  name="comment"
                  value={form.comment}
                  onChange={e=> setForm(f=> ({ ...f, comment:e.target.value.slice(0,160) }))}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  maxLength={160}
                />
                <div className="mt-1 text-[11px] text-gray-500 self-end">{(form.comment||'').length}/160</div>
              </div>
              <div className="col-span-1 sm:col-span-2 flex gap-2">
                <Button onClick={()=> setAddOpen(false)} variant="outline" className="w-full sm:w-auto sm:flex-1">Cancel</Button>
                <Button onClick={submitAdd} className="w-full sm:w-auto sm:flex-1 bg-blue-600 text-white">Create</Button>
              </div>
              </div>
            </div>
            </div>
          </DialogContent>
        </Dialog>
  )}

  {/* Preview Export Modal (styled like official export, first 20 rows) */}
  {previewOpen && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Preview Export</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Top header */}
              <div className="text-center font-bold text-white py-3 rounded" style={{ backgroundColor: '#1F3251' }}>
                {`${academicYearFilter && academicYearFilter !== 'ALL' ? academicYearFilter : 'Academic Year'} | CADT | IDT | CS Department | Terms Operate`}
              </div>
              {/* Term start row (placeholder unless dates provided) */}
              <div className="text-center font-semibold text-white py-2 rounded" style={{ backgroundColor: '#ED7D31' }}>
                ► Term Start : [start - end]
              </div>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200">
                      {['No','Subject','Hour','Credit','Total class','Lecturers and TAs','Group','Theory','Lab','Only15h','Only30h','Status','Availability','Survey Form','Contacted By','Comments'].map(h => (
                        <th key={h} className="px-2 py-2 text-center font-bold border border-gray-300 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => {
                      const st = String(r.status || '').toLowerCase();
                      const statusStyle = st === 'accepted' ? { backgroundColor: '#00B050', color: 'white' } : st === 'rejected' ? { backgroundColor: '#FF0000', color: 'white' } : st === 'pending' ? { backgroundColor: '#FFC000' } : {};
                      return (
                        <tr key={`pr-${i}`}>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.no}</td>
                          <td className="px-2 py-2 border border-gray-300">{r.subject}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.hour}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.credit}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.total_class}</td>
                          <td className="px-2 py-2 border border-gray-300">{r.lecturers}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.group}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.theory}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.lab}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.only15h}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.only30h}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center" style={statusStyle}>{r.status}</td>
                          <td className="px-2 py-2 border border-gray-300">{r.availability}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.survey}</td>
                          <td className="px-2 py-2 border border-gray-300">{r.contactedBy}</td>
                          <td className="px-2 py-2 border border-gray-300">{r.comments}</td>
                        </tr>
                      );
                    })}
                    {previewRows.length === 0 && (
                      <tr><td className="px-2 py-6 text-center text-gray-500" colSpan={16}>No data to preview</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={()=> setPreviewOpen(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

  {editOpen && editing && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Mapping</DialogTitle></DialogHeader>
            <div className="max-h-[80vh] sm:max-h-[70vh] overflow-y-auto px-2">
              <div className="w-full max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col min-w-0">
                <label htmlFor="editMappingLecturer" className="block text-sm font-medium text-gray-700 mb-1">Lecturer</label>
                <select id="editMappingLecturer" name="lecturer_profile_id" value={form.lecturer_profile_id} onChange={e=> setForm(f=> ({ ...f, lecturer_profile_id:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Unassigned</option>
                  {(() => {
                    // In edit mode respect the selected/loaded course in form.course_id
                    const filtered = form.course_id ? lecturers.filter(l => Array.isArray(l.courses) && l.courses.some(cc => String(cc.id) === String(form.course_id) || String(cc.course_code) === String((courseMap[form.course_id]?.course_code || '')))) : lecturers;
                    if (!filtered.length) return <option value="" disabled>No lecturers for selected course</option>;
                    return filtered.map(l=> <option key={l.id} value={l.id}>{l.name}</option>);
                  })()}
                </select>
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="editMappingGroups" className="block text-sm font-medium text-gray-700 mb-1">Groups</label>
                <input
                  id="editMappingGroups"
                  name="group_count"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  value={form.group_count}
                  onChange={e=> {
                    const val = e.target.value;
                    setForm(f=> ({ ...f, group_count: val }));
                  }}
                  onBlur={e=> {
                    const v = parseInt(e.target.value, 10);
                    setForm(f=> ({ ...f, group_count: (isNaN(v) || v < 1) ? 1 : v }));
                  }}
                  className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="editMappingTypeHours" className="block text-sm font-medium text-gray-700 mb-1">Type & Hours</label>
                <select id="editMappingTypeHours" name="type_hours" value={form.type_hours} onChange={e=> setForm(f=> ({ ...f, type_hours:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Theory (15h)</option>
                  <option>Lab (30h)</option>
                  <option>Only 15h</option>
                  <option>Only 30h</option>
                </select>
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="editMappingAvailability" className="block text-sm font-medium text-gray-700 mb-1">Availability (days)</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map(day => {
                    const active = selectedAvailabilityDays.has(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleAvailabilityDay(day)}
                        className={`min-w-[44px] px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        aria-pressed={active}
                      >{day.slice(0,3)}</button>
                    );
                  })}
                </div>
                <input id="editMappingAvailability" name="availability" value={form.availability} onChange={e=> setForm(f=> ({ ...f, availability:e.target.value }))} className="sr-only" readOnly />
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="editMappingStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="editMappingStatus" name="status" value={form.status} onChange={e=> setForm(f=> ({ ...f, status:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Pending</option>
                  <option>Contacting</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </div>
              <div className="col-span-2 flex flex-col">
                <label htmlFor="editMappingContactedBy" className="block text-sm font-medium text-gray-700 mb-1">Contacted By</label>
                <input id="editMappingContactedBy" name="contacted_by" value={form.contacted_by} onChange={e=> setForm(f=> ({ ...f, contacted_by:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2 flex flex-col">
                <label htmlFor="editMappingComment" className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  id="editMappingComment"
                  name="comment"
                  value={form.comment}
                  onChange={e=> setForm(f=> ({ ...f, comment:e.target.value.slice(0,160) }))}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  maxLength={160}
                />
                <div className="mt-1 text-[11px] text-gray-500 self-end">{(form.comment||'').length}/160</div>
              </div>
              <div className="col-span-2 flex flex-col sm:flex-row gap-2">
                <Button onClick={()=> { setEditOpen(false); setEditing(null); }} variant="outline" className="w-full sm:flex-1">Cancel</Button>
                <Button onClick={submitEdit} className="w-full sm:flex-1 bg-blue-600 text-white">Save</Button>
              </div>
              </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </>
  );
}
