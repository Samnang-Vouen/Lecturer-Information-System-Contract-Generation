import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// NOTE: XLSX is dynamically imported on demand to reduce Vite optimize pressure
import axiosInstance from '../../lib/axios.js';
import { Plus, Edit, Users, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { useAuthStore } from '../../store/useAuthStore.js';
import Checkbox from '../../components/ui/Checkbox.jsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Ensure pdfMake has fonts in Vite/ESM
try { if (pdfMake && pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) { pdfMake.vfs = pdfFonts.pdfMake.vfs; } } catch { /* noop */ }

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
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState([]);
  // Dialog-local error banners
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');
  // Teaching type UI state for Add/Edit dialogs (dual selection)
  const [theorySelectedAdd, setTheorySelectedAdd] = useState(false);
  const [theoryHourAdd, setTheoryHourAdd] = useState(''); // '15h' | '30h'
  const [theoryGroupsAdd, setTheoryGroupsAdd] = useState('');
  // Optional metadata: for 15h theories, user can indicate groups may be combined later (contract mgmt)
  const [theoryCombineAdd, setTheoryCombineAdd] = useState(false);
  const [labSelectedAdd, setLabSelectedAdd] = useState(false);
  const [labGroupsAdd, setLabGroupsAdd] = useState('');
  const [theorySelectedEdit, setTheorySelectedEdit] = useState(false);
  const [theoryHourEdit, setTheoryHourEdit] = useState('');
  const [theoryGroupsEdit, setTheoryGroupsEdit] = useState('');
  const [theoryCombineEdit, setTheoryCombineEdit] = useState(false);
  const [labSelectedEdit, setLabSelectedEdit] = useState(false);
  const [labGroupsEdit, setLabGroupsEdit] = useState('');
  // Availability popover state (Add/Edit dialogs)
  const [availabilityOpenAdd, setAvailabilityOpenAdd] = useState(false);
  const [availabilityOpenEdit, setAvailabilityOpenEdit] = useState(false);
  const addAvailBtnRef = useRef(null);
  const editAvailBtnRef = useRef(null);
  const [addPopoverStyle, setAddPopoverStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 0, placement: 'above' });
  const [editPopoverStyle, setEditPopoverStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 0, placement: 'above' });
  const addPopoverRef = useRef(null);
  const editPopoverRef = useRef(null);
  // No special pointer-type guards; handle mouse via click and touch/pen via pointerup.

  // Quick lookup maps
  const classMap = useMemo(()=> Object.fromEntries((Array.isArray(classes)?classes:[]).map(c=> [c.id, c])), [classes]);
  const courseMap = useMemo(()=> Object.fromEntries((Array.isArray(courses)?courses:[]).map(c=> [c.id, c])), [courses]);

  // Row builder for preview/export-like table
  const buildRow = useCallback((r) => {
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
    return { subject, hour: hours, credit: credits, total_class: totalClass, lecturers: lecturerName, group, theory, lab, only15h, only30h, status, availability, survey, contactedBy, comments };
  }, [courseMap]);

  // Group mappings by class/term/year (used for UI and selection-based preview)
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

      // Helper extractors with legacy fallbacks
      const getTheoryGroups = (e) => {
        if (Number.isFinite(e?.theory_groups)) return Math.max(0, e.theory_groups);
        if (/theory|15h/i.test(String(e?.type_hours||''))) return Math.max(0, e?.group_count||0);
        return 0;
      };
      const getLabGroups = (e) => {
        if (Number.isFinite(e?.lab_groups)) return Math.max(0, e.lab_groups);
        if (/lab|30h/i.test(String(e?.type_hours||''))) return Math.max(0, e?.group_count||0);
        return 0;
      };
      const getTheoryPerGroup = (e) => {
        const th = String(e?.theory_hours||'').toLowerCase();
        if (th.includes('15')) return 15;
        if (th.includes('30')) return 30;
        // legacy fallback via type_hours
        return String(e?.type_hours||'').includes('15h') ? 15 : 30;
      };

      // Compute hoursNeeded per subject (course): groups × subject_hours
      // Deduplicate per course_id and take the max groups across entries for that subject
      const perCourseGroups = new Map(); // course_id -> groups
      for (const e of entries) {
        const cid = e.course_id ?? e.course?.id;
        if (!cid) continue;
        const thG = getTheoryGroups(e);
        const lbG = getLabGroups(e);
        let candidate = Math.max(thG, lbG);
        if (!candidate) candidate = Math.max(0, e?.group_count || 0);
        const prev = perCourseGroups.get(cid) || 0;
        if (candidate > prev) perCourseGroups.set(cid, candidate);
      }
      let hoursNeeded = 0;
      for (const [cid, groupsCnt] of perCourseGroups.entries()) {
        const crs = (courseMap && courseMap[cid]) || {};
        const subjectHoursRaw = crs.hours; // could be number or string
        const subjectHours = Number.isFinite(subjectHoursRaw) ? subjectHoursRaw : parseInt(String(subjectHoursRaw||'0'), 10) || 0;
        hoursNeeded += groupsCnt * subjectHours;
      }

      // Compute hoursAssigned from Accepted entries only
      const hoursAssigned = entries.reduce((sum, e) => {
        if (String(e.status) !== 'Accepted') return sum;
        const theoryGroups = getTheoryGroups(e);
        const labGroups = getLabGroups(e);
        let add = 0;
        if (theoryGroups > 0) {
          const perGroup = getTheoryPerGroup(e); // 15 or 30
          add += theoryGroups * perGroup;
        }
        if (labGroups > 0) {
          add += labGroups * 30; // Lab always 30h per group
        }
        return sum + add;
      }, 0);

      const stats = {
        total: entries.length,
        pending: entries.filter(e=> e.status==='Pending').length,
        assigned: entries.filter(e=> e.status==='Accepted' && e.lecturer_profile_id).length,
        hoursAssigned,
        hoursNeeded
      };
      filteredGroups.push({ ...group, entries, stats });
    });
    return filteredGroups.sort((a,b)=> ( (b.class?.academic_year||'') ).localeCompare(a.class?.academic_year||'') || (a.class?.name||'').localeCompare(b.class?.name||''));
  }, [mappings, academicYearFilter, termFilter, statusFilter, courseMap]);

  // Default preview rows (first 20 total)
  const defaultPreviewRows = useMemo(() => {
    const rows = (Array.isArray(mappings) ? mappings : []).slice(0, 20);
    return rows.map((r, idx) => ({ no: idx + 1, ...buildRow(r) }));
  }, [mappings, buildRow]);

  // Selection-based preview rows (all selected groups)
  const selectedPreviewRows = useMemo(() => {
    if (!selectedGroupKeys.length) return [];
    const sel = new Set(selectedGroupKeys);
    const collected = [];
    (Array.isArray(grouped) ? grouped : []).forEach(g => {
      if (!sel.has(g.key)) return;
      (g.entries || []).forEach(e => collected.push(buildRow(e)));
    });
    return collected.map((r, idx) => ({ no: idx + 1, ...r }));
  }, [selectedGroupKeys, grouped, buildRow]);

  // Current rows shown in preview
  const currentPreviewRows = useMemo(() => (
    selectedPreviewRows.length ? selectedPreviewRows : defaultPreviewRows
  ), [selectedPreviewRows, defaultPreviewRows]);

  // Export current preview as PDF
  const exportPreviewAsPdf = useCallback(() => {
    const department = authUser?.department || 'Department';
    const ay = (academicYearFilter && academicYearFilter !== 'ALL') ? academicYearFilter : 'Academic Year';
    const headerText = `${ay} | CADT | IDT | ${department} | Terms Operate`;

    const tableHeader = ['No','Subject','Hour','Credit','Total class','Lecturers and TAs','Group','Theory','Lab','Only15h','Only30h','Status','Availability','Survey Form','Contacted By','Comments'];
    const body = [
      tableHeader.map(h => ({ text: h, bold: true, alignment: 'center' }))
    ];
    currentPreviewRows.forEach(r => {
      const st = String(r.status || '').toLowerCase();
      const statusFill = st === 'accepted' ? '#00B050' : (st === 'rejected' ? '#FF0000' : (st === 'pending' ? '#FFC000' : undefined));
      body.push([
        { text: String(r.no || ''), alignment: 'center' },
        { text: String(r.subject || ''), alignment: 'left' },
        { text: String(r.hour || ''), alignment: 'center' },
        { text: String(r.credit || ''), alignment: 'center' },
        { text: String(r.total_class || ''), alignment: 'center' },
        { text: String(r.lecturers || ''), alignment: 'left' },
        { text: String(r.group || ''), alignment: 'center' },
        { text: String(r.theory || ''), alignment: 'center' },
        { text: String(r.lab || ''), alignment: 'center' },
        { text: String(r.only15h || ''), alignment: 'center' },
        { text: String(r.only30h || ''), alignment: 'center' },
        { text: String(r.status || ''), alignment: 'center', color: statusFill ? 'white' : undefined, fillColor: statusFill },
        { text: String(r.availability || ''), alignment: 'left' },
        { text: String(r.survey || ''), alignment: 'center' },
        { text: String(r.contactedBy || ''), alignment: 'left' },
        { text: String(r.comments || ''), alignment: 'left' }
      ]);
    });

  const doc = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [12, 16, 12, 16],
      content: [
    { text: headerText, bold: true, color: 'white', alignment: 'center', margin: [0, 0, 0, 6], fillColor: '#1F3251', fontSize: 11 },
        {
          table: {
            headerRows: 1,
            widths: [20, '*', 30, 36, 42, 88, 32, 30, 30, 40, 40, 48, 70, 56, 60, '*'],
            body
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex === 0 ? '#EEEEEE' : (rowIndex % 2 === 0 ? '#FAFAFA' : null)),
            hLineColor: '#CCCCCC',
    vLineColor: '#CCCCCC',
            paddingLeft: () => 1,
            paddingRight: () => 1,
            paddingTop: () => 0,
            paddingBottom: () => 0
          },
          fontSize: 7
        }
      ]
    };
    pdfMake.createPdf(doc).download(`CourseMapping_${ay.replace(/\s+/g,'_')}.pdf`);
  }, [currentPreviewRows, authUser, academicYearFilter]);

  // Export XLSX from preview (respects selected checkboxes)
  const exportPreviewAsXlsx = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['No','Subject','Hour','Credit','Total class','Lecturers and TAs','Group','Theory','Lab','Only15h','Only30h','Status','Availability','Survey Form','Contacted By','Comments'];
      const data = [
        headers,
        ...currentPreviewRows.map(r => [
          r.no ?? '',
          r.subject ?? '',
          r.hour ?? '',
          r.credit ?? '',
          r.total_class ?? '',
          r.lecturers ?? '',
          r.group ?? '',
          r.theory ?? '',
          r.lab ?? '',
          r.only15h ?? '',
          r.only30h ?? '',
          r.status ?? '',
          r.availability ?? '',
          r.survey ?? '',
          r.contactedBy ?? '',
          r.comments ?? ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 4 },  { wch: 30 }, { wch: 6 }, { wch: 7 }, { wch: 10 }, { wch: 24 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 28 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CourseMapping');
      const ay = (academicYearFilter && academicYearFilter !== 'ALL') ? academicYearFilter : 'All';
      const scope = selectedGroupKeys && selectedGroupKeys.length ? 'Selected' : 'Preview';
      XLSX.writeFile(wb, `CourseMapping_${ay}_${scope}.xlsx`);
    } catch (e) {
      console.error(e);
    }
  }, [currentPreviewRows, academicYearFilter, selectedGroupKeys]);

  // Keep selection consistent with filters/group changes
  useEffect(() => {
    setSelectedGroupKeys(prev => prev.filter(k => (grouped || []).some(g => g.key === k)));
  }, [grouped]);

  const [form, setForm] = useState({
    class_id: '',
    course_id: '',
    lecturer_profile_id: '',
    academic_year: '',
    term: '',
    year_level: '',
    group_count: 1,
    type_hours: '',
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

  // Selection mode handlers
  const toggleAllGroups = useCallback((checked) => {
    setSelectedGroupKeys(checked ? (grouped || []).map(g => g.key) : []);
  }, [grouped]);
  const toggleOneGroup = useCallback((key) => {
    setSelectedGroupKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  // Availability day options (Mon-Fri) and helpers
  const DAY_OPTIONS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const SESSION_OPTIONS = [
    { id: 'S1', label: 'Session 1', time: '08:00 – 09:30' },
    { id: 'S2', label: 'Session 2', time: '09:50 – 11:30' },
    { id: 'S3', label: 'Session 3', time: '12:10 – 13:40' },
    { id: 'S4', label: 'Session 4', time: '13:50 – 15:20' },
    { id: 'S5', label: 'Session 5', time: '15:30 – 17:00' },
  ];

  // Map time text to session id for robust parsing
  const timeToId = useMemo(() => Object.fromEntries(SESSION_OPTIONS.map(s => [s.time.replace(/\s/g,'').toLowerCase(), s.id])), []);
  const idToTime = useMemo(() => Object.fromEntries(SESSION_OPTIONS.map(s => [s.id, s.time])), []);

  // Parse existing availability string to a map: { [day]: Set(sessionIds) }
  const parseAvailability = useCallback((str) => {
    const map = new Map();
    if (!str) return map;
    const raw = String(str);
    // If previous format was just comma-separated days, treat as all sessions selected for those days
    const hasColon = raw.includes(':');
    if (!hasColon && /monday|tuesday|wednesday|thursday|friday/i.test(raw)) {
      const tokens = raw.split(/[,;|]/).map(t=>t.trim()).filter(Boolean);
      tokens.forEach(tok => {
        const day = DAY_OPTIONS.find(d => d.toLowerCase().startsWith(tok.toLowerCase()));
        if (day) map.set(day, new Set(SESSION_OPTIONS.map(s=>s.id)));
      });
      return map;
    }
    // Expected format: "Monday: S1, S2; Tuesday: 08:00 – 09:30"
    raw.split(';').map(s=>s.trim()).filter(Boolean).forEach(chunk => {
      const sepIdx = chunk.indexOf(':');
      const dayPart = sepIdx >= 0 ? chunk.slice(0, sepIdx) : chunk;
      const rest = sepIdx >= 0 ? chunk.slice(sepIdx + 1) : '';
      const day = DAY_OPTIONS.find(d => d.toLowerCase().startsWith((dayPart||'').trim().toLowerCase()));
      if (!day) return;
      const set = map.get(day) || new Set();
      (rest||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(tok => {
        // Accept S1..S5 OR time label
        const upper = tok.toUpperCase();
        if (/^S[1-5]$/.test(upper)) set.add(upper);
        else {
          const key = tok.replace(/\s/g,'').toLowerCase();
          const id = timeToId[key];
          if (id) set.add(id);
        }
      });
      if (set.size) map.set(day, set);
    });
    return map;
  }, [timeToId]);

  const serializeAvailability = useCallback((map) => {
    if (!map || !(map instanceof Map)) return '';
    const parts = [];
    for (const day of DAY_OPTIONS) {
      const set = map.get(day);
      if (!set || set.size === 0) continue;
  // Store compact S-codes to DB (S1–S5). Parser accepts both S-codes and times.
  const codes = Array.from(set).sort().join(', ');
  parts.push(`${day}: ${codes}`);
    }
    return parts.join('; ');
  }, [idToTime]);

  const availabilityMap = useMemo(() => parseAvailability(form.availability), [form.availability, parseAvailability]);

  const toggleSession = useCallback((day, sessionId) => {
    setForm(f => {
      const current = parseAvailability(f.availability);
      const set = new Set(current.get(day) || []);
      if (set.has(sessionId)) set.delete(sessionId); else set.add(sessionId);
      if (set.size) current.set(day, set); else current.delete(day);
      return { ...f, availability: serializeAvailability(current) };
    });
  }, [parseAvailability, serializeAvailability, setForm]);

  const clearAvailability = useCallback(() => {
    setForm(f => ({ ...f, availability: '' }));
  }, []);

  const availabilitySummary = useMemo(() => {
    if (!availabilityMap || availabilityMap.size === 0) return '';
    const short = [];
    for (const day of DAY_OPTIONS) {
      const set = availabilityMap.get(day);
      if (set && set.size) short.push(`${day.slice(0,3)} ${Array.from(set).sort().join(',')}`);
    }
    return short.join('; ');
  }, [availabilityMap]);


  // Reposition popover near trigger
  const computePopover = useCallback((btn) => {
    if (!btn) return { top: 0, left: 0, width: 0, maxHeight: 0, placement: 'above' };
    const rect = btn.getBoundingClientRect();
    const padding = 8;
    const width = Math.min(640, Math.floor(window.innerWidth * 0.9));
    let left = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding));
    const availableAbove = Math.max(0, rect.top - 2 * padding);
    const top = Math.max(padding, rect.top - padding);
    const maxHeight = Math.min(Math.max(120, availableAbove), Math.floor(window.innerHeight * 0.9));
    return { top, left, width, maxHeight, placement: 'above' };
  }, []);

  useEffect(() => {
    if (availabilityOpenAdd) setAddPopoverStyle(computePopover(addAvailBtnRef.current));
    if (availabilityOpenEdit) setEditPopoverStyle(computePopover(editAvailBtnRef.current));
  }, [availabilityOpenAdd, availabilityOpenEdit, computePopover]);

  useEffect(() => {
    function onWinChange() {
      if (availabilityOpenAdd) setAddPopoverStyle(computePopover(addAvailBtnRef.current));
      if (availabilityOpenEdit) setEditPopoverStyle(computePopover(editAvailBtnRef.current));
    }
    window.addEventListener('resize', onWinChange);
    window.addEventListener('scroll', onWinChange, true);
    return () => {
      window.removeEventListener('resize', onWinChange);
      window.removeEventListener('scroll', onWinChange, true);
    };
  }, [availabilityOpenAdd, availabilityOpenEdit, computePopover]);

  // Close when dialog closes
  useEffect(() => {
    if (!addOpen) setAvailabilityOpenAdd(false);
  }, [addOpen]);
  useEffect(() => {
    if (!editOpen) setAvailabilityOpenEdit(false);
  }, [editOpen]);

  // Outside click (pointerdown) / Escape to close
  useEffect(() => {
    function onDocPointerDown(e) {
      const addBtn = addAvailBtnRef.current;
      const editBtn = editAvailBtnRef.current;
      const addPop = addPopoverRef.current;
      const editPop = editPopoverRef.current;
      if (availabilityOpenAdd) {
        const inBtn = !!(addBtn && (e.target === addBtn || addBtn.contains(e.target)));
        const inPop = !!(addPop && (e.target === addPop || addPop.contains(e.target)));
        if (!inBtn && !inPop) setAvailabilityOpenAdd(false);
      }
      if (availabilityOpenEdit) {
        const inBtn = !!(editBtn && (e.target === editBtn || editBtn.contains(e.target)));
        const inPop = !!(editPop && (e.target === editPop || editPop.contains(e.target)));
        if (!inBtn && !inPop) setAvailabilityOpenEdit(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') { setAvailabilityOpenAdd(false); setAvailabilityOpenEdit(false); }
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDocPointerDown); document.removeEventListener('keydown', onKey); };
  }, [availabilityOpenAdd, availabilityOpenEdit]);

  const startAdd = () => {
  setForm({ ...form, class_id:'', course_id:'', lecturer_profile_id:'', academic_year:'', term:'', year_level:'', group_count:1, type_hours:'', availability:'', status:'Pending', contacted_by:'', contactedBy:'', comment:'' });
    // reset teaching type UI (dual)
  setTheorySelectedAdd(false); setTheoryHourAdd(''); setTheoryGroupsAdd(''); setTheoryCombineAdd(false); setLabSelectedAdd(false); setLabGroupsAdd('');
  setAddError('');
    setAddOpen(true);
  };

  const submitAdd = async () => {
    try {
      // Validate dual selections (treat invalid group counts as not selected)
      let thGroups = 0, thHours = null, lbGroups = 0, lbHours = null;
      const thG = parseInt(String(theoryGroupsAdd), 10);
      const lbG = parseInt(String(labGroupsAdd), 10);
      const thHourValid = theoryHourAdd === '15h' || theoryHourAdd === '30h';
      const theoryEffective = theorySelectedAdd && Number.isFinite(thG) && thG >= 1 && thHourValid;
      const labEffective = labSelectedAdd && Number.isFinite(lbG) && lbG >= 1;
      if (!theoryEffective && !labEffective) { setAddError('Select Theories and/or Labs.'); return; }
      if (theoryEffective) { thGroups = thG; thHours = theoryHourAdd; }
      if (labEffective) { lbGroups = lbG; lbHours = '30h'; }
      const payload = {
        ...form,
        // legacy fields left minimally filled for compatibility; server will derive when new fields present
        type_hours: (thHours==='15h') ? 'Theory (15h)' : (lbHours ? 'Lab (30h)' : 'Theory (15h)'),
        group_count: thGroups || lbGroups || 1,
        theory_hours: thHours,
        theory_groups: thGroups,
        // metadata only; does not affect assigned hours math
        theory_15h_combined: (thHours==='15h') ? !!theoryCombineAdd : false,
        theory_combined: ((thHours==='15h' || thHours==='30h') && thGroups>1) ? !!theoryCombineAdd : false,
        lab_hours: lbHours,
        lab_groups: lbGroups,
        course_id: form.course_id ? parseInt(form.course_id, 10) : '',
        comment: (form.comment || '').slice(0, 160)
      };
  // Normalize contacted_by for API, prefer new camelCase field
  payload.contacted_by = form.contactedBy || form.contacted_by || '';
  delete payload.contactedBy;
      if (!payload.academic_year || !payload.year_level || !payload.term || !payload.class_id || !payload.course_id) return;
      await axiosInstance.post('/course-mappings', payload);
      setAddOpen(false);
      loadData(true);
    } catch (e) { setAddError(e.response?.data?.message || e.message); }
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
    theory_hours: m.theory_hours || '',
    theory_groups: m.theory_groups ?? '',
    lab_hours: m.lab_hours || '',
    lab_groups: m.lab_groups ?? '',
    availability: m.availability || '',
    status: m.status,
    contacted_by: m.contacted_by || '',
    comment: m.comment || ''
  });
  // init dual UI for Edit (prefer new fields, fallback legacy)
  const hasTheory = Number.isFinite(m.theory_groups) ? (m.theory_groups > 0) : (/theory|15h/i.test(String(m.type_hours||'')) && (m.group_count||0)>0);
  const hasLab = Number.isFinite(m.lab_groups) ? (m.lab_groups > 0) : (/lab|30h/i.test(String(m.type_hours||'')) && (m.group_count||0)>0);
  setTheorySelectedEdit(hasTheory);
  setLabSelectedEdit(hasLab);
  setTheoryHourEdit(m.theory_hours || (hasTheory ? (String(m.type_hours||'').includes('15h')? '15h':'30h') : ''));
  setTheoryGroupsEdit(String(Number.isFinite(m.theory_groups)? m.theory_groups : (hasTheory? (m.group_count||1): '')));
  setTheoryCombineEdit(!!(m.theory_15h_combined ?? m.theory_combined ?? m.combine_theory_groups));
  setLabGroupsEdit(String(Number.isFinite(m.lab_groups)? m.lab_groups : (hasLab? (m.group_count||1): '')));
  setEditOpen(true); };

  const submitEdit = async () => {
    if (!editing) return;
    try {
  // Validate dual selections (treat invalid group counts as not selected)
  let thGroups = 0, thHours = null, lbGroups = 0, lbHours = null;
  const thG = parseInt(String(theoryGroupsEdit), 10);
  const lbG = parseInt(String(labGroupsEdit), 10);
  const thHourValid = theoryHourEdit === '15h' || theoryHourEdit === '30h';
  const theoryEffective = theorySelectedEdit && Number.isFinite(thG) && thG >= 1 && thHourValid;
  const labEffective = labSelectedEdit && Number.isFinite(lbG) && lbG >= 1;
  if (!theoryEffective && !labEffective) { setEditError('Select Theories and/or Labs.'); return; }
  if (theoryEffective) { thGroups = thG; thHours = theoryHourEdit; }
  if (labEffective) { lbGroups = lbG; lbHours = '30h'; }
  const payload = {};
  ['lecturer_profile_id','availability','status','contacted_by','comment'].forEach(k=> { payload[k]=form[k]; });
  payload.type_hours = (thHours==='15h') ? 'Theory (15h)' : (lbHours ? 'Lab (30h)' : 'Theory (15h)');
  payload.group_count = thGroups || lbGroups || 1;
  payload.theory_hours = thHours;
  payload.theory_groups = thGroups;
  payload.theory_15h_combined = (thHours==='15h') ? !!theoryCombineEdit : false;
  payload.theory_combined = ((thHours==='15h' || thHours==='30h') && thGroups>1) ? !!theoryCombineEdit : false;
  payload.lab_hours = lbHours;
  payload.lab_groups = lbGroups;
  payload.comment = (form.comment || '').slice(0, 160);
      await axiosInstance.put(`/course-mappings/${editing.id}`, payload);
      setEditOpen(false); setEditing(null); loadData(true);
    } catch (e) { setEditError(e.response?.data?.message || e.message); }
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
          {!previewMode ? (
            <Button
              onClick={() => { setPreviewMode(true); setSelectedGroupKeys([]); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-10"
            >Download</Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Selected: {selectedGroupKeys.length}</span>
              <Button
                onClick={() => setPreviewOpen(true)}
                disabled={selectedGroupKeys.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 h-10"
              >Generate Preview</Button>
              <Button
                variant="outline"
                onClick={() => { setPreviewMode(false); setSelectedGroupKeys([]); }}
                className="h-10"
              >Cancel</Button>
            </div>
          )}

          {/* Removed top-level Official Export button; use preview modal actions instead */}
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
          {previewMode && (
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="cm-select-all"
                checked={grouped.length>0 && selectedGroupKeys.length === grouped.length}
                onCheckedChange={(val)=> toggleAllGroups(!!val)}
              />
              <label htmlFor="cm-select-all" className="text-sm text-gray-700">Select all</label>
            </div>
          )}
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        {/* NOTE: Client-side filters applied: Academic Year, Term, Status */}
        <div className="space-y-8">
          {grouped.map(g => {
            const completion = g.stats.total? Math.round((g.stats.assigned / g.stats.total)*100):0;
            const academicYear = g.class?.academic_year || g.entries[0]?.academic_year;
            const selected = selectedGroupKeys.includes(g.key);
            return (
              <div key={g.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 pt-5 pb-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                      {previewMode && (
                        <div className="mt-0.5">
                          <Checkbox
                            id={`cm-row-${g.key}`}
                            checked={selected}
                            onCheckedChange={()=> toggleOneGroup(g.key)}
                          />
                        </div>
                      )}
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
                        <th className="px-3 py-3 font-medium">Theory Groups</th>
                        <th className="px-3 py-3 font-medium">Lab Groups</th>
                        <th className="px-3 py-3 font-medium">Hours</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {g.entries.map(m => {
                        const statusColor = m.status==='Accepted'? 'bg-green-100 text-green-700': m.status==='Contacting'? 'bg-blue-100 text-blue-700': m.status==='Rejected'? 'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700';
                        const rowKey = String(m.id ?? `${m.class_id}-${m.course_id}-${m.term}-${m.academic_year}`);
                        const isTheoryLegacy = /theory|15h/i.test(String(m.type_hours||''));
                        const isLabLegacy = /lab|30h/i.test(String(m.type_hours||''));
                        const theoryGroups = Number.isFinite(m?.theory_groups) ? m.theory_groups : (isTheoryLegacy ? (m.group_count || 0) : 0);
                        const labGroups = Number.isFinite(m?.lab_groups) ? m.lab_groups : (isLabLegacy ? (m.group_count || 0) : 0);
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
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{theoryGroups ?? 0}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{labGroups ?? 0}</td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex flex-wrap gap-1">
                                {theoryGroups>0 && (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Theory {m.theory_hours || (String(m.type_hours||'').includes('15h')?'15h':'30h')} × {theoryGroups}</span>
                                )}
                                {labGroups>0 && (
                                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">Lab 30h × {labGroups}</span>
                                )}
                                {(theoryGroups===0 && labGroups===0) && (
                                  m.type_hours ? <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{m.type_hours}</span> : <span className="italic text-gray-400">not yet</span>
                                )}
                              </div>
                            </td>
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
              {addError && (
                <div role="alert" className="mb-3 mx-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
                  {addError}
                </div>
              )}
              <div className="max-h-[80vh] sm:max-h-[70vh] overflow-y-auto px-2">
                <div className="w-full max-w-2xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-min text-sm">
              {/* 1) Academic Year */}
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingAcademicYear" className="block text-sm font-medium text-gray-700 mb-1">Academic Year*</label>
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
                <label htmlFor="newMappingYearLevel" className="block text-sm font-medium text-gray-700 mb-1">Year Level*</label>
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
                <label htmlFor="newMappingTerm" className="block text-sm font-medium text-gray-700 mb-1">Term*</label>
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
                <label htmlFor="newMappingClass" className="block text-sm font-medium text-gray-700 mb-1">Class*</label>
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
                <label htmlFor="newMappingCourse" className="block text-sm font-medium text-gray-700 mb-1">Course*</label>
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
                <label htmlFor="newMappingLecturer" className="block text-sm font-medium text-gray-700 mb-1">Lecturer*</label>
                <select id="newMappingLecturer" name="lecturer_profile_id" value={form.lecturer_profile_id} onChange={e=> setForm(f=> ({ ...f, lecturer_profile_id:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={!form.course_id}>
                  <option value="">Unassigned</option>
                  {(() => {
                    const filtered = form.course_id ? lecturers.filter(l => Array.isArray(l.courses) && l.courses.some(cc => String(cc.id) === String(form.course_id) || String(cc.course_code) === String((courseMap[form.course_id]?.course_code || '')))) : [];
                    if (!filtered.length) return <option value="" disabled>No lecturers for selected course</option>;
                    return filtered.map(l=> <option key={l.id} value={l.id}>{l.name}</option>);
                  })()}
                </select>
              </div>
              {/* Teaching Type: Allow selecting both Theories and Labs with their own groups */}
              <div className="col-span-1 sm:col-span-2 flex flex-col gap-4">
                <span className="block text-sm font-medium text-gray-700">Teaching Type*</span>
                {/* Theories block */}
                <div className={`rounded-xl border transition-all shadow-sm ${theorySelectedAdd ? 'border-blue-400 ring-1 ring-blue-100 bg-blue-50/30' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between p-3 sm:p-4 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={theorySelectedAdd}
                        onChange={e => { setTheorySelectedAdd(e.target.checked); if (!e.target.checked) { setTheoryHourAdd(''); setTheoryGroupsAdd(''); setTheoryCombineAdd(false); } }}
                      />
                      <span aria-hidden className="h-4 w-4 rounded-[4px] border border-gray-300 bg-white grid place-content-center peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 peer-checked:border-blue-600">
                        <svg className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium text-gray-900">Theory</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Hours</span>
                      <div className="inline-flex overflow-hidden rounded-full border border-gray-300 shadow-sm">
                        <button
                          type="button"
                          disabled={!theorySelectedAdd}
                          aria-pressed={theoryHourAdd==='15h'}
                          className={`px-3 py-1.5 text-sm transition-colors ${theoryHourAdd==='15h' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${!theorySelectedAdd ? 'opacity-60 cursor-not-allowed' : ''}`}
                          onClick={()=> setTheoryHourAdd('15h')}
                        >15h</button>
                        <button
                          type="button"
                          disabled={!theorySelectedAdd}
                          aria-pressed={theoryHourAdd==='30h'}
                          className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-300 ${theoryHourAdd==='30h' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${!theorySelectedAdd ? 'opacity-60 cursor-not-allowed' : ''}`}
                          onClick={()=> setTheoryHourAdd('30h')}
                        >30h</button>
                      </div>
                    </div>
                  </div>
                  {theorySelectedAdd && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Theory groups</label>
                      <div className="relative">
                        <input type="number" inputMode="numeric" min={1} step={1} value={theoryGroupsAdd} onChange={e=> setTheoryGroupsAdd(e.target.value)} className="block w-full h-10 border border-gray-300 rounded-md pl-3 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 2" />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">groups</span>
                      </div>
                      {/* {((theoryHourAdd==='15h' || theoryHourAdd==='30h') && (parseInt(String(theoryGroupsAdd), 10) > 1)) && (
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                          <input type="checkbox" className="sr-only peer" checked={theoryCombineAdd} onChange={e=> setTheoryCombineAdd(e.target.checked)} />
                          <span aria-hidden className="h-3.5 w-3.5 rounded-[3px] border border-gray-300 bg-white grid place-content-center peer-checked:bg-blue-600 peer-checked:border-blue-600">
                            <svg className="h-2.5 w-2.5 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </span>
                          Combine groups into 1
                        </label>
                      )} */}
                    </div>
                  )}
                </div>
                {/* Labs block */}
                <div className={`rounded-xl border transition-all shadow-sm ${labSelectedAdd ? 'border-blue-400 ring-1 ring-blue-100 bg-blue-50/30' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between p-3 sm:p-4 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={labSelectedAdd}
                        onChange={e => { setLabSelectedAdd(e.target.checked); if (!e.target.checked) { setLabGroupsAdd(''); } }}
                      />
                      <span aria-hidden className="h-4 w-4 rounded-[4px] border border-gray-300 bg-white grid place-content-center peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 peer-checked:border-blue-600">
                        <svg className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium text-gray-900">Lab</span>
                    </label>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">30h</span>
                  </div>
                  {labSelectedAdd && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Lab groups</label>
                      <div className="relative">
                        <input type="number" inputMode="numeric" min={1} step={1} value={labGroupsAdd} onChange={e=> setLabGroupsAdd(e.target.value)} className="block w-full h-10 border border-gray-300 rounded-md pl-3 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 1" />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">groups</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability*</label>
                <div className="relative">
                  <button
                    ref={addAvailBtnRef}
                    type="button"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-left text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[2.25rem]"
                    aria-haspopup="dialog"
                    aria-expanded={availabilityOpenAdd}
                    onClick={() => setAvailabilityOpenAdd(v=>!v)}
                  >
                    <span className="whitespace-pre-wrap break-words leading-snug text-gray-700">
                      {availabilitySummary || <span className="text-gray-400">Choose Availability</span>}
                    </span>
                  </button>
                      {availabilityOpenAdd && createPortal(
                    <div
                      ref={addPopoverRef}
                      className="z-[100]"
                      style={{ position:'fixed', top:addPopoverStyle.top, left:addPopoverStyle.left, width:addPopoverStyle.width, transform: addPopoverStyle.placement==='above' ? 'translateY(-100%)' : 'none' }}
                      onPointerDown={(e)=> { e.stopPropagation(); }}
                    >
                      <div className="overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-4" style={{ maxHeight: addPopoverStyle.maxHeight }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">Select Availability</div>
                          <div className="flex gap-2">
                            <button type="button" onClick={(e)=> { e.stopPropagation(); clearAvailability(); }} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Clear</button>
                            <button type="button" onClick={(e)=> { e.stopPropagation(); setAvailabilityOpenAdd(false); }} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Done</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {DAY_OPTIONS.map(day => (
                            <div key={`add-${day}`} className="border border-gray-200 rounded-md">
                              <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">{day}</div>
                              <div className="p-2 flex flex-wrap gap-2">
                                {SESSION_OPTIONS.map(s => {
                                  const active = !!(availabilityMap.get(day) && availabilityMap.get(day).has(s.id));
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onMouseDown={(e)=> { e.preventDefault(); toggleSession(day, s.id); }}
                                      onPointerUp={(e)=> { if (e.pointerType && e.pointerType !== 'mouse') { toggleSession(day, s.id); } }}
                                      onKeyDown={(e)=> { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); e.stopPropagation(); toggleSession(day, s.id); } }}
                                      className={`px-3 py-2 rounded-full border text-xs font-medium transition-colors text-center ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                      aria-pressed={active}
                                      title={s.time}
                                    >
                                      <span className="block leading-tight">{s.label}</span>
                                      <span className={`block leading-tight text-[10px] ${active ? 'text-white/90' : 'text-gray-500'}`}>{(s.time || '').replace(/\s*–\s*/, '-')}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="px-3 pb-2 text-[11px] text-gray-500">{Array.from(availabilityMap.get(day) || []).sort().map(id=> idToTime[id] || id).join(', ') || 'No sessions'}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500">Sessions: S1 (08:00–09:30), S2 (09:50–11:30), S3 (12:10–13:40), S4 (13:50–15:20), S5 (15:30–17:00)</div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
                <input id="newMappingAvailability" name="availability" value={form.availability} onChange={e=> setForm(f=> ({ ...f, availability:e.target.value }))} className="sr-only" readOnly />
              </div>
              <div className="flex flex-col min-w-0">
                <label htmlFor="newMappingStatus" className="block text-sm font-medium text-gray-700 mb-1">Status*</label>
                <select id="newMappingStatus" name="status" value={form.status} onChange={e=> setForm(f=> ({ ...f, status:e.target.value }))} className="block w-full h-9 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Pending</option>
                  <option>Contacting</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </div>
              {/* Contacted By */}
              <div className="col-span-1 sm:col-span-2 flex flex-col">
                <label htmlFor="newMappingContactedBy" className="block text-sm font-medium text-gray-700 mb-1">Contacted By*</label>
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
          <DialogContent className="max-w-[1100px] w-[95vw]">
            <DialogHeader>
              <DialogTitle>Preview Export</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Top header */}
              <div className="text-center font-semibold text-white py-3 rounded-md shadow-sm ring-1 ring-blue-900/20" style={{ backgroundColor: '#1F3251' }}>
                {(() => {
                  const department = authUser?.department || 'Department';
                  const ay = academicYearFilter && academicYearFilter !== 'ALL' ? academicYearFilter : 'Academic Year';
                  return `${ay} | CADT | IDT | ${department} | Terms Operate`;
                })()}
              </div>
              {/* Removed term start placeholder banner */}
              {/* Summary + actions */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Showing {currentPreviewRows.length} row{currentPreviewRows.length!==1 && 's'}{selectedGroupKeys.length ? ` from ${selectedGroupKeys.length} class${selectedGroupKeys.length!==1 ? 'es' : ''}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={exportPreviewAsPdf} className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white">Download PDF</Button>
                  <Button onClick={exportPreviewAsXlsx} className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white">Download XLSX</Button>
                </div>
              </div>
              <div className="overflow-auto border border-gray-200 rounded-lg max-h-[65vh] bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      {['No','Subject','Hour','Credit','Total class','Lecturers and TAs','Group','Theory','Lab','Only15h','Only30h','Status','Availability','Survey Form','Contacted By','Comments'].map((h, idx) => (
                        <th
                          key={h}
                          className="px-2 py-2 text-center font-semibold text-[12px] uppercase tracking-wide border border-gray-200 whitespace-nowrap sticky top-0 z-10"
                          style={{ minWidth: idx===0?24: idx===1? 200: idx===5? 180: idx===12? 160: idx===14? 140: 80 }}
                        >{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPreviewRows.map((r, i) => {
                      const st = String(r.status || '').toLowerCase();
                      const statusStyle = st === 'accepted' ? { backgroundColor: '#00B050', color: 'white' } : st === 'rejected' ? { backgroundColor: '#FF0000', color: 'white' } : st === 'pending' ? { backgroundColor: '#FFC000' } : {};
                      return (
                        <tr key={`pr-${i}`} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50') + ' hover:bg-blue-50/40'}>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.no}</td>
                          <td className="px-2 py-2 border border-gray-300 whitespace-pre-wrap break-words">{r.subject}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.hour}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.credit}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.total_class}</td>
                          <td className="px-2 py-2 border border-gray-300 whitespace-pre-wrap break-words">{r.lecturers}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.group}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.theory}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.lab}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.only15h}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.only30h}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center" style={statusStyle}>{r.status}</td>
                          <td className="px-2 py-2 border border-gray-300 whitespace-pre-wrap break-words">{r.availability}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{r.survey}</td>
                          <td className="px-2 py-2 border border-gray-300 whitespace-pre-wrap break-words">{r.contactedBy}</td>
                          <td className="px-2 py-2 border border-gray-300 whitespace-pre-wrap break-words">{r.comments}</td>
                        </tr>
                      );
                    })}
                    {currentPreviewRows.length === 0 && (
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
            {editError && (
              <div role="alert" className="mb-3 mx-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
                {editError}
              </div>
            )}
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
              {/* Teaching Type (Edit): Dual selection with checkboxes */}
              <div className="col-span-1 sm:col-span-2 flex flex-col gap-4">
                <span className="block text-sm font-medium text-gray-700">Teaching Type</span>
                {/* Theories block */}
                <div className={`rounded-xl border transition-all shadow-sm ${theorySelectedEdit ? 'border-blue-400 ring-1 ring-blue-100 bg-blue-50/30' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between p-3 sm:p-4 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={theorySelectedEdit}
                        onChange={e => { setTheorySelectedEdit(e.target.checked); if (!e.target.checked) { setTheoryHourEdit(''); setTheoryGroupsEdit(''); setTheoryCombineEdit(false); } }}
                      />
                      <span aria-hidden className="h-4 w-4 rounded-[4px] border border-gray-300 bg-white grid place-content-center peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 peer-checked:border-blue-600">
                        <svg className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium text-gray-900">Theory</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Hours</span>
                      <div className="inline-flex overflow-hidden rounded-full border border-gray-300 shadow-sm">
                        <button type="button" disabled={!theorySelectedEdit} aria-pressed={theoryHourEdit==='15h'} className={`px-3 py-1.5 text-sm transition-colors ${theoryHourEdit==='15h' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${!theorySelectedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={()=> setTheoryHourEdit('15h')}>15h</button>
                        <button type="button" disabled={!theorySelectedEdit} aria-pressed={theoryHourEdit==='30h'} className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-300 ${theoryHourEdit==='30h' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${!theorySelectedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={()=> setTheoryHourEdit('30h')}>30h</button>
                      </div>
                    </div>
                  </div>
                  {theorySelectedEdit && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Theory groups</label>
                      <div className="relative">
                        <input type="number" inputMode="numeric" min={1} step={1} value={theoryGroupsEdit} onChange={e=> setTheoryGroupsEdit(e.target.value)} className="block w-full h-10 border border-gray-300 rounded-md pl-3 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 2" />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">groups</span>
                      </div>
                      {((theoryHourEdit==='15h' || theoryHourEdit==='30h') && (parseInt(String(theoryGroupsEdit), 10) > 1)) && (
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                          <input type="checkbox" className="sr-only peer" checked={theoryCombineEdit} onChange={e=> setTheoryCombineEdit(e.target.checked)} />
                          <span aria-hidden className="h-3.5 w-3.5 rounded-[3px] border border-gray-300 bg-white grid place-content-center peer-checked:bg-blue-600 peer-checked:border-blue-600">
                            <svg className="h-2.5 w-2.5 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </span>
                          Combine groups into 1
                        </label>
                      )}
                    </div>
                  )}
                </div>
                {/* Labs block */}
                <div className={`rounded-xl border transition-all shadow-sm ${labSelectedEdit ? 'border-blue-400 ring-1 ring-blue-100 bg-blue-50/30' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between p-3 sm:p-4 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={labSelectedEdit}
                        onChange={e => { setLabSelectedEdit(e.target.checked); if (!e.target.checked) { setLabGroupsEdit(''); } }}
                      />
                      <span aria-hidden className="h-4 w-4 rounded-[4px] border border-gray-300 bg-white grid place-content-center peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-blue-600 peer-checked:border-blue-600">
                        <svg className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium text-gray-900">Lab</span>
                    </label>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">30h</span>
                  </div>
                  {labSelectedEdit && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Lab groups</label>
                      <div className="relative">
                        <input type="number" inputMode="numeric" min={1} step={1} value={labGroupsEdit} onChange={e=> setLabGroupsEdit(e.target.value)} className="block w-full h-10 border border-gray-300 rounded-md pl-3 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 1" />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">groups</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                <div className="relative">
                  <button
                    ref={editAvailBtnRef}
                    type="button"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-left text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[2.25rem]"
                    aria-haspopup="dialog"
                    aria-expanded={availabilityOpenEdit}
                    onClick={() => setAvailabilityOpenEdit(v=>!v)}
                  >
                    <span className="whitespace-pre-wrap break-words leading-snug text-gray-700">
                      {availabilitySummary || <span className="text-gray-400">Choose Availability</span>}
                    </span>
                  </button>
                    {availabilityOpenEdit && createPortal(
                    <div
                      ref={editPopoverRef}
                      className="z-[100]"
                    style={{ position:'fixed', top:editPopoverStyle.top, left:editPopoverStyle.left, width:editPopoverStyle.width, transform: editPopoverStyle.placement==='above' ? 'translateY(-100%)' : 'none' }}
                      onPointerDown={(e)=> { e.stopPropagation(); }}
                    >
                      <div className="overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-4" style={{ maxHeight: editPopoverStyle.maxHeight }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">Select Availability</div>
                          <div className="flex gap-2">
                            <button type="button" onClick={(e)=> { e.stopPropagation(); clearAvailability(); }} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Clear</button>
                            <button type="button" onClick={(e)=> { e.stopPropagation(); setAvailabilityOpenEdit(false); }} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Done</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {DAY_OPTIONS.map(day => (
                            <div key={`edit-${day}`} className="border border-gray-200 rounded-md">
                              <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">{day}</div>
                              <div className="p-2 flex flex-wrap gap-2">
                                {SESSION_OPTIONS.map(s => {
                                  const active = !!(availabilityMap.get(day) && availabilityMap.get(day).has(s.id));
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onMouseDown={(e)=> { e.preventDefault(); toggleSession(day, s.id); }}
                                      onPointerUp={(e)=> { if (e.pointerType && e.pointerType !== 'mouse') { toggleSession(day, s.id); } }}
                                      onKeyDown={(e)=> { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); e.stopPropagation(); toggleSession(day, s.id); } }}
                                      className={`px-3 py-2 rounded-full border text-xs font-medium transition-colors text-center ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                      aria-pressed={active}
                                      title={s.time}
                                    >
                                      <span className="block leading-tight">{s.label}</span>
                                      <span className={`block leading-tight text-[10px] ${active ? 'text-white/90' : 'text-gray-500'}`}>{(s.time || '').replace(/\s*–\s*/, '-')}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="px-3 pb-2 text-[11px] text-gray-500">{Array.from(availabilityMap.get(day) || []).sort().map(id=> idToTime[id] || id).join(', ') || 'No sessions'}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500">Sessions: S1 (08:00–09:30), S2 (09:50–11:30), S3 (12:10–13:40), S4 (13:50–15:20), S5 (15:30–17:00)</div>
                      </div>
                    </div>,
                    document.body
                  )}
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
