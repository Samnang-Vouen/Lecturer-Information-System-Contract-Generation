import React, { useEffect, useMemo, useRef, useState } from 'react';
import { axiosInstance } from '../../lib/axios.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Eye, Download, CheckCircle2, AlertCircle, Clock, Filter as FilterIcon, FileText, MoreHorizontal } from 'lucide-react';

export default function ManagementContracts(){
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [openMenuFor, setOpenMenuFor] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchContracts = async ()=>{
    try{
      setLoading(true);
      const res = await axiosInstance.get('/teaching-contracts', { params: { page, limit, q: q || undefined, status: status || undefined } });
      setContracts(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ fetchContracts(); }, [page, limit, q, status]);

  // Close action menu on outside click
  useEffect(() => {
    const onDocClick = () => setOpenMenuFor(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const statusLabel = (s) => {
    switch (s) {
      case 'DRAFT': return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
      case 'LECTURER_SIGNED': return { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: AlertCircle };
      case 'MANAGEMENT_SIGNED': return { label: 'Management Signed', class: 'bg-purple-50 text-purple-700 border-purple-200', icon: CheckCircle2 };
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
    setPendingUploadId(c.id);
    setOpenMenuFor(null);
    if (fileInputRef.current) fileInputRef.current.click();
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
          <Input className="pl-3" placeholder="Search by contract ID, lecturer name, or department..." value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded px-2 py-1.5">
            <FilterIcon className="w-4 h-4 text-gray-500" />
            <select value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(1); }} className="text-sm outline-none bg-transparent">
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="LECTURER_SIGNED">Waiting Management</option>
              <option value="MANAGEMENT_SIGNED">Management Signed</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

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
            {(contracts||[]).map(c => {
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${st.class}`}>
                      {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                      {st.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="relative flex justify-end items-center">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === c.id ? null : c.id); }} title="Actions">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                      {openMenuFor === c.id && (
                        <div className="absolute right-0 top-8 z-10 w-44 rounded-md border bg-white shadow-lg" onClick={(e)=> e.stopPropagation()}>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left" onClick={() => { previewPdfFor(c.id); setOpenMenuFor(null); }}>
                            <Eye className="w-4 h-4" />
                            <span>View Contract</span>
                          </button>
                          <button
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${canApprove ? 'hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
                            disabled={!canApprove || uploading}
                            onClick={() => handleSignClick(c, canApprove)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Sign Contract</span>
                          </button> 
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left" onClick={() => { window.open(`${axiosInstance.defaults.baseURL}/teaching-contracts/${c.id}/pdf`, '_blank'); setOpenMenuFor(null); }}>
                            <Download className="w-4 h-4" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center mt-3">
        <Button variant="outline" onClick={()=> setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</Button>
        <span className="text-sm text-gray-600">Page {page}</span>
        <Button variant="outline" onClick={()=> setPage(p => (p*limit < total ? p+1 : p))} disabled={page*limit >= total}>Next</Button>
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
    </div>
  );
}
