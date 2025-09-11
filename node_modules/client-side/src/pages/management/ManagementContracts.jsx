import React, { useEffect, useMemo, useRef, useState } from 'react';
import { axiosInstance } from '../../lib/axios.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Eye, Download, CheckCircle2, AlertCircle, Clock, Filter as FilterIcon, FileText, BellRing, PenTool } from 'lucide-react';

export default function ManagementContracts(){
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  // Actions are now icon buttons; no dropdown state needed
  const [uploading, setUploading] = useState(false);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const fileInputRef = useRef(null);
  // Dialog for upload
  const [showUploadDlg, setShowUploadDlg] = useState(false);
  const [uploadContractId, setUploadContractId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const fetchContracts = async ()=>{
    try{
      setLoading(true);
      const res = await axiosInstance.get('/teaching-contracts', { params: { page, limit, q: q || undefined, status: status || undefined } });
      setContracts(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ fetchContracts(); }, [page, limit, q, status]);

  // No action menu dropdown, so no outside-click handler

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
      case 'DRAFT': return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
      case 'LECTURER_SIGNED': return { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: AlertCircle };
  case 'WAITING_LECTURER': return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
  case 'MANAGEMENT_SIGNED': return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'COMPLETED': return { label: 'completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 };
      default: return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
    }
  };

  const previewPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };

  const approveAsManagement = async (c) => {
    try{
      await axiosInstance.patch(`/teaching-contracts/${c.id}/status`, { status: 'MANAGEMENT_SIGNED' });
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

  const onSelectSignatureFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    const id = pendingUploadId;
    // reset input so the same file can be selected again later
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPendingUploadId(null);
    if (!file || !id) return;
    await uploadManagementSignature(id, file);
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Contract Management</h1>
        <p className="text-gray-600 mt-1">Review and approve contracts</p>
      </div>

      {/* Search and filter */}
      <div className="rounded-xl border bg-white shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Input className="pl-3 h-11 rounded-xl" placeholder="Search lecturer name without title" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-300 rounded-xl h-11 px-3 bg-white">
            <FilterIcon className="w-4 h-4 text-gray-500" />
            <select value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(1); }} className="text-sm outline-none bg-transparent h-full py-0">
              <option value="">All Status</option>
              <option value="LECTURER_SIGNED">Waiting Management</option>
              <option value="WAITING_LECTURER">Waiting Lecturer</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pending management signatures */}
      {(() => {
        const pending = (contracts || []).filter(x => x.status === 'LECTURER_SIGNED');
        if (!pending.length) return null;
        const fmt = (v) => { try { if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }); } catch { return ''; } };
        const toCtr = (c) => { const y = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear(); return `CTR-${y}-${String(c.id).padStart(3,'0')}`; };
        const toHours = (c) => (c.courses || []).reduce((a, cc) => a + (cc?.hours || 0), 0);
        const toRate = (c) => { const r = c.hourlyRateThisYear; const n = r != null && r !== '' ? Number(r) : null; return Number.isFinite(n) ? n : null; };
        return (
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-amber-700 font-semibold"><Clock className="w-4 h-4"/> Contracts Awaiting Your Signature ({pending.length})</div>
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
                  <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{ctr}</div>
                      <div className="text-sm text-amber-900 mt-1">{rate != null ? `$${rate}/hr` : '-'} • {hours} hours</div>
                      {(startDate || endDate) && (
                        <div className="text-sm text-amber-900">{fmt(startDate)}{startDate && endDate ? ' - ' : ''}{fmt(endDate)}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        className="cursor-pointer"
                        size="sm"
                        onClick={() => previewPdfFor(c.id)}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Review
                      </Button>
                      <Button
                        className="cursor-pointer"
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
          </div>
        );
      })()}

      {/* Contracts table card */}
      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <div className="flex items-center gap-2 text-gray-800 font-semibold"><FileText className="w-4 h-4 text-blue-600"/> Contracts ({total})</div>
          <div className="ml-auto text-sm text-gray-600 hidden md:block">{loading ? 'Loading…' : `${(contracts?.length||0)} of ${total}`}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract ID</TableHead>
              <TableHead>Lecturer</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(filteredContracts||[]).map(c => {
              const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
              const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3,'0')}`;
              const startDate = c.start_date || c.startDate || null;
              const endDate = c.end_date || c.endDate || null;
              const formatMDY = (value) => { if(!value) return ''; try{ const d=new Date(value); if(isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-US',{year:'numeric',month:'numeric',day:'numeric'});} catch{return '';} };
              const period = startDate && endDate ? (
                <div className="text-sm leading-tight">
                  <div>{formatMDY(startDate)}</div>
                  <div className="text-gray-600">to {formatMDY(endDate)}</div>
                </div>
              ) : (
                <span>{`Term ${c.term} • ${c.academic_year}`}</span>
              );
              const st = statusLabel(c.status);
              const canApprove = c.status === 'LECTURER_SIGNED';
              const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
              const rate = (c.hourlyRateThisYear != null && c.hourlyRateThisYear !== '') 
                ? Number(c.hourlyRateThisYear) 
                : null;
              const salary = (rate != null && Number.isFinite(Number(rate)) && Number.isFinite(Number(hours)))
                ? Number(rate) * Number(hours)
                : null;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{formattedId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{c.lecturer?.display_name || c.lecturer?.email || '—'}</div>
                    <div className="text-xs text-gray-500">{c.lecturer?.email}</div>
                  </TableCell>
                  <TableCell>{c.lecturer?.department_name || '—'}</TableCell>
                  <TableCell>{period}</TableCell>
                  <TableCell>
                    <div className="text-sm leading-tight">
                      <div className="font-medium">{rate != null ? `$${rate}/hr` : '-'}</div>
                      <div className="text-gray-600">{hours}h total</div>
                      {salary != null && (
                        <div className="text-gray-600">${salary.toLocaleString('en-US')} salary</div>
                      )}
                    </div>
                  </TableCell> 
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${st.class}`}>
                        {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                        {st.label}
                      </span>
                      {canApprove && (
                        <span
                          className="inline-flex items-center justify-center rounded-full p-1.5 text-amber-700 border border-amber-200 bg-amber-50 animate-pulse"
                          title="Awaiting management signature"
                          aria-label="Awaiting management signature"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
          <div className="flex justify-end items-center gap-2">
                      <Button
            size="sm"
            variant="outline"
            className="w-10 h-10 p-0 rounded-xl border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition-colors"
            title="View Contract"
            aria-label="View Contract"
                        onClick={() => previewPdfFor(c.id)}
                      >
                        <Eye className="w-5 h-5" strokeWidth={2.25} />
                      </Button>
                      <Button
            size="sm"
            variant="outline"
            className={`w-10 h-10 p-0 rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 ${canApprove ? 'border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-500 focus:ring-amber-300' : 'border border-gray-300 bg-gray-50 text-gray-400 focus:ring-gray-200'}`}
            title={canApprove ? 'Sign Contract' : 'Waiting for lecturer'}
            aria-label={canApprove ? 'Sign Contract' : 'Waiting for lecturer'}
                        disabled={!canApprove || uploading}
                        onClick={() => handleSignClick(c, canApprove)}
                      >
                        <PenTool className="w-5 h-5" strokeWidth={2.25} />
                      </Button>
                      <Button
            size="sm"
            variant="outline"
            className="w-10 h-10 p-0 rounded-xl border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition-colors"
            title="Download PDF"
            aria-label="Download PDF"
                        onClick={() => window.open(`${axiosInstance.defaults.baseURL}/teaching-contracts/${c.id}/pdf`, '_blank')}
                      >
                        <Download className="w-5 h-5" strokeWidth={2.25} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* Hidden file input for management signature upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelectSignatureFile}
        disabled={uploading}
      />

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
    </div>
  );
}
