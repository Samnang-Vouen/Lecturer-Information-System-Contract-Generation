import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { axiosInstance } from '../../lib/axios.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import Select, { SelectItem } from '../../components/ui/Select.jsx';
import { Eye, Download, CircleCheck, Clock, Filter as FilterIcon, FileText, BellRing, PenTool, Info, User, Building2, Calendar, DollarSign, Ellipsis } from 'lucide-react';

export default function ManagementContracts(){
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  // Actions
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  // Dialog for upload
  const [showUploadDlg, setShowUploadDlg] = useState(false);
  const [uploadContractId, setUploadContractId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContract, setDetailContract] = useState(null);
  // Ellipsis menus
  const [menuOpenId, setMenuOpenId] = useState(null);

  const fetchContracts = async ()=>{
    try{
      setLoading(true);
      const res = await axiosInstance.get('/teaching-contracts', { params: { page, limit, q: q || undefined, status: status || undefined } });
      setContracts(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ fetchContracts(); }, [page, limit, q, status]);

  // Close ellipsis menu on outside click
  useEffect(() => {
    const onDoc = () => setMenuOpenId(null);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Client-side search: dynamic, case-insensitive, starts-with on lecturer name only (ignore titles)
  const filteredContracts = useMemo(() => {
    const normalize = (s) => (s || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    const stripTitle = (s) => {
      const titles = '(mr|mrs|ms|miss|dr|prof|professor)';
      return s.replace(new RegExp(`^${titles}\\s+`, 'i'), '').trim();
    };
    const qRaw = normalize(q);
    const qName = stripTitle(qRaw);
    // Start with server results and apply status filter again client-side for robustness
    const base = (contracts || []).filter(c => {
      if (!status) return true;
      // If the selected filter is WAITING_LECTURER, match that exact status
      return c.status === status;
    });
    if (!qName) return base;
    return base.filter(c => {
      const lecturerTitle = normalize(c.lecturer?.LecturerProfile?.title || c.lecturer?.title || '');
      const lecturerNameBase = normalize(c.lecturer?.display_name || c.lecturer?.full_name || c.lecturer?.full_name_english || c.lecturer?.full_name_khmer || c.lecturer?.email || '');
      const fullName = `${lecturerTitle ? lecturerTitle + ' ' : ''}${lecturerNameBase}`.trim();
      const candidate = stripTitle(fullName);
      if (!candidate) return false;
      if (candidate.startsWith(qName)) return true;
      const tokens = candidate.split(' ').filter(Boolean);
      return tokens.some(t => t.startsWith(qName));
    });
  }, [contracts, q, status]);

  const statusLabel = (s) => {
    switch (s) {
      case 'DRAFT':
        return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
      case 'WAITING_MANAGEMENT':
        return { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock };
      case 'WAITING_LECTURER':
        return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'MANAGEMENT_SIGNED':
        return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'COMPLETED':
        return { label: 'completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CircleCheck };
      default:
        return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
    }
  };

  const previewPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };

  // Build a safe filename from lecturer info (include normalized title like Dr/Prof/Mr/Ms/Mrs)
  const deriveLecturerBaseName = (lecturer) => {
    if (!lecturer) return '';
    // Raw title from profile
    const rawTitle = lecturer?.LecturerProfile?.title || lecturer?.title || '';
    const t = String(rawTitle || '').toLowerCase().replace(/\./g, '').trim();
    const prettyTitle = t === 'dr'
      ? 'Dr'
      : t === 'prof' || t === 'professor'
      ? 'Prof'
      : t === 'mr'
      ? 'Mr'
      : t === 'ms' || t === 'miss'
      ? 'Ms'
      : t === 'mrs'
      ? 'Mrs'
      : (rawTitle ? String(rawTitle) : '');

    // Prefer human display name; fall back to email local-part
    let name = lecturer?.display_name || lecturer?.full_name || lecturer?.full_name_english || lecturer?.full_name_khmer || lecturer?.name || lecturer?.email || '';
    if (name.includes('@')) name = name.split('@')[0];
    // Strip common titles if prefixed in the name itself to avoid duplication
    name = name.replace(/^(mr|mrs|ms|miss|dr|prof|professor)\.?\s+/i, '');
    name = name.trim();
    return prettyTitle ? `${prettyTitle} ${name}`.trim() : name;
  };

  const toSafePdfFilename = (baseName, id) => {
    let safe = String(baseName || '')
      .replace(/[\/:*?"<>|]+/g, ' ') // illegal -> space
      .replace(/\s+/g, ' ') // compress spaces
      .trim();
    if (!safe) safe = `contract-${id}`;
    // Replace spaces with underscores for cleaner filenames
    safe = safe.replace(/\s+/g, '_');
    // limit length and ensure .pdf extension
    safe = safe.slice(0, 80);
    return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
  };

  // Download PDF directly as file without opening preview
  const downloadPdfFor = async (id, filename) => {
    try {
      setDownloadingId(id);
      const res = await axiosInstance.get(`/teaching-contracts/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `contract-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // optionally handle error (toast/log)
    } finally {
      setDownloadingId(null);
    }
  };

  const approveAsManagement = async (c) => {
    try{
      await axiosInstance.patch(`/teaching-contracts/${c.id}/status`, { status: 'WAITING_LECTURER' });
      await fetchContracts();
    } catch {}
  };

  // Upload management signature via multipart/form-data
  const uploadManagementSignature = async (id, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('who', 'management');
      await axiosInstance.post(`/teaching-contracts/${id}/signature`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchContracts();
    } catch (e) {
      // noop
    } finally {
      setUploading(false);
    }
  };

  const handleSignClick = (c, canApprove) => {
    if (!canApprove) return;
  // Open dialog to choose image instead of direct file input
  setUploadContractId(c.id);
  setSelectedFile(null);
  setUploadError('');
  // no dropdown to close
  setShowUploadDlg(true);
  };

  // Format lecturer title + name from available fields
  const formatLecturerDisplay = (lecturer) => {
    if (!lecturer) return '—';
    const rawTitle = lecturer?.LecturerProfile?.title || lecturer?.title || '';
    const name = lecturer?.display_name || lecturer?.full_name || lecturer?.full_name_english || lecturer?.full_name_khmer || lecturer?.name || lecturer?.email || '—';

    const norm = (s='') => String(s).toLowerCase().replace(/\./g, '').trim();
    const prettyTitle = (() => {
      const t = norm(rawTitle);
      if (!t) return '';
      switch (t) {
        case 'mr': case 'mister': return 'Mr.';
        case 'ms': case 'miss': return 'Ms.';
        case 'mrs': return 'Mrs.';
        case 'dr': case 'doctor': return 'Dr.';
        case 'prof': case 'professor': return 'Prof.';
        default: {
          // Capitalize first letter; add dot for 2-3 letter common abbreviations
          const cap = rawTitle.charAt(0).toUpperCase() + String(rawTitle).slice(1);
          return cap.length <= 4 && !/[\.!]$/.test(cap) ? `${cap}.` : cap;
        }
      }
    })();

    // Avoid duplicating title if already present in name
    const nameNorm = norm(name);
    const titleNorm = norm(prettyTitle);
    if (titleNorm && (nameNorm.startsWith(titleNorm + ' ') || nameNorm === titleNorm)) {
      return name;
    }
    return prettyTitle ? `${prettyTitle} ${name}` : name;
  };

  const formatMDY = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch { return ''; }
  };

  const getDepartmentName = (c) => {
    const fromLecturer = c?.lecturer?.department_name || c?.lecturer?.department || '';
    const fromCourse = c?.courses?.[0]?.Course?.Department?.name || c?.courses?.[0]?.Course?.department_name || '';
    return fromLecturer || fromCourse || '—';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="p-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Contract Management
            </h1>
            <p className="text-gray-600">Review and approve contracts</p>
          </div>
        </motion.div>

        {/* Search and filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl border bg-white/80 backdrop-blur-sm shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center"
        >
          <div className="relative flex-1 min-w-[220px]">
            <Input className="pl-3 h-11 rounded-xl" placeholder="Search lecturer name without title" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-gray-300 rounded-xl h-11 px-2.5 bg-white">
              <FilterIcon className="w-4 h-4 text-gray-500" />
              <div className="min-w-[160px] flex items-center">
                <Select
                  value={status}
                  onValueChange={(v)=>{ setStatus(v); setPage(1); }}
                  placeholder="All Status"
                  className="w-full"
                  unstyled
                  buttonClassName="h-11 text-sm bg-transparent px-1 pr-6"
                >
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="WAITING_MANAGEMENT">Waiting Management</SelectItem>
                  <SelectItem value="WAITING_LECTURER">Waiting Lecturer</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </Select>
              </div>
            </div>
          </div>
        </motion.div>

  {/* Pending management signatures */}
      {(() => {
  const pending = (contracts || []).filter(x => x.status === 'WAITING_MANAGEMENT');
        if (!pending.length) return null;
        const fmt = (v) => { try { if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }); } catch { return ''; } };
        const toCtr = (c) => { const y = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear(); return `CTR-${y}-${String(c.id).padStart(3,'0')}`; };
        const toHours = (c) => (c.courses || []).reduce((a, cc) => a + (cc?.hours || 0), 0);
        const toRate = (c) => { const r = c.hourlyRateThisYear; const n = r != null && r !== '' ? Number(r) : null; return Number.isFinite(n) ? n : null; };
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border bg-white/80 backdrop-blur-sm shadow-sm p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <Clock className="w-4 h-4"/> Contracts Awaiting Your Signature ({pending.length})
                </div>
                <p className="text-sm text-gray-600 mt-1">These contracts require your digital signature to proceed</p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {pending.map(c => {
                const ctr = toCtr(c);
                const hours = toHours(c);
                const rate = toRate(c);
                const startDate = c.start_date || c.startDate || null;
                const endDate = c.end_date || c.endDate || null;
                return (
                  <div key={c.id} className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{ctr}</div>
                      <div className="text-sm text-amber-900 mt-1">{rate != null ? `$${rate}/hr` : '-'} • {hours} hours</div>
                      {(startDate || endDate) && (
                        <div className="text-sm text-amber-900">{fmt(startDate)}{startDate && endDate ? ' - ' : ''}{fmt(endDate)}</div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="cursor-pointer w-full sm:w-auto"
                        size="sm"
                        onClick={() => previewPdfFor(c.id)}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Review
                      </Button>
                      <Button
                        className="cursor-pointer w-full sm:w-auto"
                        size="sm"
                        onClick={() => handleSignClick(c, true)}
                        disabled={uploading}
                      >
                        <PenTool className="w-4 h-4 mr-1.5" />
                        Sign Now
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* Count header above cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-lg">All My Contracts ({(filteredContracts || []).length})</span>
          </div>
          <div className="text-sm text-gray-600 mt-0.5">Complete history of your contracts</div>
        </div>
      </motion.div>

      {/* Unified card grid (mobile + desktop) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        {(filteredContracts || []).map(c => {
          const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
          const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
          const st = statusLabel(c.status);
          const canApprove = c.status === 'WAITING_MANAGEMENT';
          const startDate = c.start_date || c.startDate || null;
          const endDate = c.end_date || c.endDate || null;
          const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
          const rate = (c.hourlyRateThisYear != null && c.hourlyRateThisYear !== '') ? Number(c.hourlyRateThisYear) : null;
          const salary = (rate != null && Number.isFinite(Number(rate)) && Number.isFinite(Number(hours))) ? Number(rate) * Number(hours) : null;
          return (
            <div key={c.id} className="group rounded-2xl border bg-white shadow-sm overflow-hidden transition hover:shadow-md hover:border-gray-200">
              {/* Header with document icon and ID + ellipsis menu */}
              <div className="px-5 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-lg">{formattedId}</span>
                  </div>
          <div className="relative" onMouseDown={(e)=>e.stopPropagation()}>
                    <button
                      type="button"
                      data-ellipsis
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(prev => prev === c.id ? null : c.id); }}
                      className={`p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
                      title="More"
                      aria-label="More actions"
                      aria-expanded={menuOpenId===c.id}
                    >
                      <Ellipsis className="w-4 h-4" />
                    </button>
                    {menuOpenId === c.id && (
                      <div className="absolute right-0 mt-1 w-44 rounded-xl border bg-white shadow-lg py-1 z-20" onMouseDown={(e)=>e.stopPropagation()}>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                          onClick={()=>{ setMenuOpenId(null); previewPdfFor(c.id); }}
                        >
                          <Eye className="w-4 h-4" /> View
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                          disabled={downloadingId===c.id}
                          onClick={()=>{ const base = deriveLecturerBaseName(c.lecturer); const fname = toSafePdfFilename(base, c.id); setMenuOpenId(null); downloadPdfFor(c.id, fname); }}
                        >
                          <Download className="w-4 h-4" /> Download PDF
                        </button>
                        <div className="my-1 h-px bg-gray-200" />
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-orange-600 flex items-center gap-2"
                          onClick={()=>{ setDetailContract(c); setDetailOpen(true); setMenuOpenId(null); }}
                        >
                          <Info className="w-4 h-4" /> Detail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lecturer section */}
              <div className="px-5 mt-4">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-base truncate">{formatLecturerDisplay(c.lecturer)}</div>
                    <div className="text-sm text-gray-600 truncate">{c.lecturer?.email}</div>
                  </div>
                </div>
              </div>

              {/* Department */}
              <div className="px-5 mt-3">
                <div className="flex items-center gap-3 text-gray-800">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{getDepartmentName(c)}</span>
                </div>
              </div>

              {/* Contract period */}
              <div className="px-5 mt-4">
                <div className="flex items-center gap-3 text-gray-800">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Contract Period</span>
                </div>
                <div className="mt-2 text-sm">
                  {startDate && endDate ? (
                    <div className="text-gray-900">
                      <div className="font-semibold">{formatMDY(startDate)}</div>
                      <div className="text-gray-600">to</div>
                      <div>{formatMDY(endDate)}</div>
                    </div>
                  ) : (
                    <div className="text-gray-900">{`Term ${c.term}`} <span className="text-gray-600">•</span> {c.academic_year}</div>
                  )}
                </div>
              </div>

              {/* Financial details */}
              <div className="px-5 mt-4">
                <div className="flex items-center gap-3 text-gray-800">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Financial Details</span>
                </div>
                <div className="mt-2 text-sm">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-700">Rate:</span>
                    <span className="text-gray-900 font-semibold">{rate != null ? `$${rate}/hr` : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-700">Hours:</span>
                    <span className="font-semibold text-gray-900">{hours}h</span>
                  </div>
                  <div className="my-2 border-t" />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-800 font-medium">Total:</span>
                    <span className="font-semibold text-green-600">{salary != null ? `$${salary.toLocaleString('en-US')}` : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Footer: status + actions (styled as requested) */}
              <div className="mt-4 px-5 py-3.5 border-t border-gray-200 flex items-center justify-between">
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none border ${st.class || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => previewPdfFor(c.id)}
                    className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Preview"
                    aria-label="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canApprove && (
                    <button
                      onClick={() => handleSignClick(c, canApprove)}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      title="Sign"
                      aria-label="Sign"
                    >
                      <PenTool className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { const base = deriveLecturerBaseName(c.lecturer); const fname = toSafePdfFilename(base, c.id); downloadPdfFor(c.id, fname); }}
                    className={`p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors ${downloadingId===c.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title="Download"
                    aria-label="Download"
                    disabled={downloadingId===c.id}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
      {/* Upload Signature Dialog */}
      <Dialog open={showUploadDlg} onOpenChange={(v)=>{ setShowUploadDlg(v); if(!v){ setSelectedFile(null); setUploadError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Management Signature</DialogTitle>
            <DialogDescription>Choose an image file to sign this contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className={`rounded-md border ${selectedFile ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} p-3`}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature photo (PNG/JPG)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e)=>{ setUploadError(''); const f=e.target.files?.[0]||null; setSelectedFile(f||null); }}
              />
              {selectedFile && (
                <div className="mt-2 text-xs text-gray-600">Selected: {selectedFile.name} ({Math.round((selectedFile.size||0)/1024)} KB)</div>
              )}
              {uploadError && <div className="mt-2 text-sm text-red-600">{uploadError}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="cursor-pointer" onClick={()=>{ setShowUploadDlg(false); }}>Cancel</Button>
              <Button
                className="cursor-pointer"
                disabled={!selectedFile || uploading}
                onClick={async ()=>{
                  if (!selectedFile || !uploadContractId) { setUploadError('Please choose an image.'); return; }
                  try {
                    await uploadManagementSignature(uploadContractId, selectedFile);
                    setShowUploadDlg(false);
                    setSelectedFile(null);
                  } catch (e) {
                    setUploadError('Failed to upload. Please try again.');
                  }
                }}
              >
                {uploading ? 'Uploading…' : 'Upload & Sign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(v)=>{ setDetailOpen(v); if(!v) setDetailContract(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract Detail</DialogTitle>
            <DialogDescription>Summary and course breakdown</DialogDescription>
          </DialogHeader>
          {detailContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Lecturer</div>
                  <div className="font-medium">{formatLecturerDisplay(detailContract.lecturer)}</div>
                  <div className="text-gray-600">{detailContract.lecturer?.email}</div>
                </div>
                <div>
                  <div className="text-gray-500">Status</div>
                  {(() => { const st = statusLabel(detailContract.status); return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${st.class}`}>
                      {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                      {st.label}
                    </span>
                  ); })()}
                </div>
                <div>
                  <div className="text-gray-500">Period</div>
                  {detailContract.start_date && detailContract.end_date ? (
                    <div>{formatMDY(detailContract.start_date)} to {formatMDY(detailContract.end_date)}</div>
                  ) : (
                    <div>{`Term ${detailContract.term}`} • {detailContract.academic_year}</div>
                  )}
                </div>
                <div>
                  <div className="text-gray-500">Financials</div>
                  {(() => {
                    const hours = (detailContract.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
                    const rate = (detailContract.hourlyRateThisYear != null && detailContract.hourlyRateThisYear !== '') ? Number(detailContract.hourlyRateThisYear) : null;
                    const salary = (rate != null && Number.isFinite(Number(rate)) && Number.isFinite(Number(hours))) ? Number(rate) * Number(hours) : null;
                    return (
                      <div>
                        <div>Rate: {rate != null ? `$${rate}/hr` : '-'}</div>
                        <div>Hours: {hours}</div>
                        <div>Total: {salary != null ? `$${salary.toLocaleString('en-US')}` : '-'}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div>
                <div className="text-gray-700 font-medium mb-2">Courses</div>
                <div className="rounded-lg border divide-y">
                  {(detailContract.courses || []).map((cc, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{cc?.Course?.name_en || cc?.Course?.name || cc?.course_name || '—'}</div>
                        <div className="text-gray-600 truncate">{cc?.Course?.code || cc?.course_code || ''}</div>
                      </div>
                      <div className="text-gray-700">{cc?.hours || 0}h</div>
                    </div>
                  ))}
                  {!(detailContract.courses || []).length && (
                    <div className="p-3 text-gray-500 text-sm">No courses listed</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
