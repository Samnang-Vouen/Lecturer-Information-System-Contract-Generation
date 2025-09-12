import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { FileText, Eye, PenTool, Download, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';

export default function LecturerContracts(){
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hourlyRate, setHourlyRate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/teaching-contracts', { params: { page, limit, q: q || undefined } });
      setContracts(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContracts(); }, [page, limit, q]);

  // Fetch lecturer profile to get Hourly Rate This Year ($)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosInstance.get('/lecturer-profile/me');
        const raw = res?.data?.hourlyRateThisYear;
        const parsed = raw != null ? parseFloat(String(raw).replace(/[^0-9.]/g, '')) : null;
        if (mounted) setHourlyRate(Number.isFinite(parsed) ? parsed : null);
      } catch {
        if (mounted) setHourlyRate(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Read secure deep link (?open=ID) once
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = parseInt(params.get('open'), 10);
      if (Number.isInteger(id)) setOpenId(id);
    } catch {}
  }, []);

  const openContract = useMemo(() => (contracts || []).find(c => c.id === openId), [contracts, openId]);

  // Pending requiring lecturer signature: DRAFT or MANAGEMENT_SIGNED with no lecturer signature
  const pendingContracts = useMemo(() => (contracts || []).filter(c => c.status === 'DRAFT' || c.status === 'MANAGEMENT_SIGNED'), [contracts]);
  const pendingCount = pendingContracts.length;

  // Auto-open deep linked contract in a dialog (sign if can, else view)
  useEffect(() => {
    if (openContract) {
      const canSign = openContract.status === 'DRAFT' || openContract.status === 'MANAGEMENT_SIGNED';
      setSelectedContract(openContract);
      if (canSign) setSignOpen(true); else setViewOpen(true);
      setOpenId(null); // prevent re-trigger
    }
  }, [openContract]);

  const previewPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };
  const downloadPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };
  const formatMDY = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch { return ''; }
  };

  const statusLabel = (s) => {
    // s is a display status: WAITING_LECTURER | WAITING_MANAGEMENT | COMPLETED | CONTRACT_ENDED | DRAFT
    switch (s) {
      case 'WAITING_LECTURER':
        return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'WAITING_MANAGEMENT':
        return { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: AlertCircle };
      case 'COMPLETED':
        return { label: 'completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 };
      case 'CONTRACT_ENDED':
        return { label: 'Contract Ended', class: 'bg-gray-100 text-red-700 border-red-200', icon: AlertCircle };
      default:
        return { label: 'draft', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText };
    }
  };

  // Compute whether a contract is expired and its display status
  const isExpired = (c) => {
    const end = c?.end_date || c?.endDate;
    if (!end) return false;
    try {
      const endD = new Date(end);
      if (isNaN(endD.getTime())) return false;
      const today = new Date();
      // Compare by date only
      endD.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      return endD < today;
    } catch { return false; }
  };

  const getDisplayStatus = (c) => {
    if (isExpired(c)) return 'CONTRACT_ENDED';
    switch (c?.status) {
      case 'DRAFT':
      case 'MANAGEMENT_SIGNED':
        return 'WAITING_LECTURER';
      case 'LECTURER_SIGNED':
        return 'WAITING_MANAGEMENT';
      case 'COMPLETED':
        return 'COMPLETED';
      default:
        return 'DRAFT';
    }
  };

  const filteredContracts = useMemo(() => {
    const list = contracts || [];
    if (statusFilter === 'ALL') return list;
    return list.filter(c => {
      const ds = getDisplayStatus(c);
      return (
        (statusFilter === 'WAITING_LECTURER' && ds === 'WAITING_LECTURER') ||
        (statusFilter === 'WAITING_MANAGEMENT' && ds === 'WAITING_MANAGEMENT') ||
        (statusFilter === 'COMPLETED' && ds === 'COMPLETED') ||
        (statusFilter === 'CONTRACT_ENDED' && ds === 'CONTRACT_ENDED')
      );
    });
  }, [contracts, statusFilter]);
  const uploadSignature = async (id, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('who', 'lecturer');
      await axiosInstance.post(`/teaching-contracts/${id}/signature`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchContracts();
    } catch (e) {
      // noop
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            My Contracts
          </h1>
          <p className="text-gray-600">View and sign your contracts</p>
        </div>
      </div>

      {/* Pending contracts card */}
      {pendingCount > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600"/>
              <CardTitle>Contracts Awaiting Your Signature ({pendingCount})</CardTitle>
            </div>
            <CardDescription>These contracts require your digital signature to proceed</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const c = pendingContracts[0];
              const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
              const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
              const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
              const startDate = c.start_date || c.startDate || null;
              const endDate = c.end_date || c.endDate || null;
              const period = startDate && endDate ? `${formatMDY(startDate)} - ${formatMDY(endDate)}` : `Term ${c.term} • ${c.academic_year}`;
              const rate = hourlyRate;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{formattedId}</div>
                    <div className="text-sm text-amber-900 mt-1">{rate != null ? `$${rate}/hr` : '-'} • {hours} hours</div>
                    <div className="text-sm text-amber-900">{period}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => previewPdfFor(c.id)} title="Preview contract"><Eye className="w-4 h-4"/> Review</Button>
                    <Button size="sm" onClick={() => { setSelectedContract(c); setSignOpen(true); }}><PenTool className="w-4 h-4"/> Sign Now</Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* All contracts card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600"/>
            <CardTitle>All My Contracts ({total})</CardTitle>
          </div>
          <CardDescription>Complete history of your lecturer contracts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-white shadow-sm overflow-x-auto w-full">
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label htmlFor="statusFilter" className="text-sm text-gray-700">Status</label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                >
                  <option value="ALL">All statuses</option>
                  <option value="WAITING_LECTURER">Waiting Lecturer</option>
                  <option value="WAITING_MANAGEMENT">Waiting Management</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CONTRACT_ENDED">Contract Ended</option>
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-600 hidden md:block">{loading ? 'Loading…' : `${(filteredContracts?.length||0)} of ${total}`}</div>
            </div>
            <div className="min-w-[720px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract ID</TableHead>
                  <TableHead className="hidden sm:table-cell">Period</TableHead>
                  <TableHead className="hidden md:table-cell">Rate & Hours</TableHead>
                  <TableHead className="hidden md:table-cell">Total Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredContracts || []).map(c => {
                  const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
                  const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
                  const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
                  const startDate = c.start_date || c.startDate || null;
                  const endDate = c.end_date || c.endDate || null;
                  const hasBothDates = !!(startDate && endDate);
                  const period = hasBothDates ? (
                    <div className="text-sm leading-tight">
                      <div>{formatMDY(startDate)}</div>
                      <div className="text-gray-600">to {formatMDY(endDate)}</div>
                    </div>
                  ) : (
                    <span>{`Term ${c.term} • ${c.academic_year}`}</span>
                  );
                  const rate = hourlyRate; // from lecturer profile
                  const totalValue = rate != null ? rate * hours : null;
                  const displayStatus = getDisplayStatus(c);
                  const st = statusLabel(displayStatus);
                  const canSign = c.status === 'DRAFT' || c.status === 'MANAGEMENT_SIGNED';
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{formattedId}</div>
                        {/* Mobile-only summary */}
                        <div className="sm:hidden mt-1 text-xs text-gray-600 space-y-0.5">
                          <div>
                            {hasBothDates ? `${formatMDY(startDate)} → ${formatMDY(endDate)}` : `Term ${c.term} • ${c.academic_year}`}
                          </div>
                          <div>{rate != null ? `$${rate}/hr` : '-'} • {hours}h</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{period}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm leading-tight">
                          <div className="font-medium">{rate != null ? `$${rate}/hr` : '-'}</div>
                          <div className="text-gray-600">{hours}h total</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm font-medium">{totalValue != null ? `$${Math.round(totalValue).toLocaleString()}` : '-'}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${st.class}`}>
                          {st.icon ? React.createElement(st.icon, { className: 'w-3.5 h-3.5' }) : null}
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap gap-1 sm:gap-2 justify-end items-center">
                          <Button size="sm" variant="outline" onClick={() => previewPdfFor(c.id)} title="Preview contract"><Eye className="w-4 h-4" /></Button>
                          {canSign && (
                            <Button size="sm" onClick={() => { setSelectedContract(c); setSignOpen(true); }} title="Sign contract"><PenTool className="w-4 h-4" /></Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => downloadPdfFor(c.id)} title="Download"><Download className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!contracts || contracts.length === 0) && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-6">No contracts found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* View Contract Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Contract Details {selectedContract ? `- CTR-${(selectedContract.created_at ? new Date(selectedContract.created_at).getFullYear() : new Date().getFullYear())}-${String(selectedContract.id).padStart(3,'0')}` : ''}</DialogTitle>
            <DialogDescription>Review your contract terms and assignments</DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="px-6 pb-6 pt-2 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Period:</span> {formatMDY(selectedContract.start_date)} - {formatMDY(selectedContract.end_date)}</div>
                  <div><span className="font-medium">Rate:</span> -</div>
                  <div><span className="font-medium">Total Hours:</span> {(selectedContract.courses || []).reduce((a,c)=>a+(c.hours||0),0)}</div>
                  <div><span className="font-medium">Total Value:</span> -</div>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Courses</h4>
                  <div className="text-sm space-y-1">
                    {(selectedContract.courses || []).map((cc)=> (
                      <div key={cc.id || `${cc.course_id}-${cc.class_id || 'x'}`}>{cc.course_name}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Signing Dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="flex items-center gap-2"><PenTool className="w-4 h-4"/> Sign Contract</DialogTitle>
            <DialogDescription>Provide your digital signature to accept this contract</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
              By signing this contract, you agree to all terms and conditions outlined in the document.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setSignOpen(false)}>Cancel</Button>
              <label className={`inline-flex items-center gap-2 ${uploading ? 'opacity-70' : 'cursor-pointer'}`}>
                <input type="file" className="hidden" accept="image/*" onChange={async (e)=> { if (selectedContract) { await uploadSignature(selectedContract.id, e.target.files[0]); setSignOpen(false); } }} disabled={uploading} />
                <span className="px-3 py-1 border rounded">Upload Signature</span>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
