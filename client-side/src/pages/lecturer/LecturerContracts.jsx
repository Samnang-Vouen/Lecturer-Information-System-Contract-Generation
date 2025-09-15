import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select, { SelectItem } from '../../components/ui/Select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { FileText, Eye, PenTool, Download, Clock, CircleCheck, AlertCircle, Filter, Loader2, Calendar, DollarSign, User2, Building2, Info, Ellipsis, X } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';

export default function LecturerContracts(){
  const { authUser } = useAuthStore();
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
  const [lecturerProfile, setLecturerProfile] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

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

  // Close ellipsis menu on outside click
  useEffect(() => {
    const onDown = (e) => {
      const inMenu = e.target.closest('[data-menu]');
      const inEllipsis = e.target.closest('[data-ellipsis]');
      if (!inMenu && !inEllipsis) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Fetch lecturer profile to get Hourly Rate This Year ($)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosInstance.get('/lecturer-profile/me');
        const raw = res?.data?.hourlyRateThisYear;
        const parsed = raw != null ? parseFloat(String(raw).replace(/[^0-9.]/g, '')) : null;
        if (mounted) setHourlyRate(Number.isFinite(parsed) ? parsed : null);
  if (mounted) setLecturerProfile(res?.data || null);
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

  // Pending requiring lecturer signature: WAITING_LECTURER (or legacy MANAGEMENT_SIGNED)
  const pendingContracts = useMemo(() => (contracts || []).filter(c => c.status === 'WAITING_LECTURER' || c.status === 'MANAGEMENT_SIGNED' || c.status === 'DRAFT'), [contracts]);
  const pendingCount = pendingContracts.length;

  // Auto-open deep linked contract in a dialog (sign if can, else view)
  useEffect(() => {
    if (openContract) {
      const canSign = openContract.status === 'DRAFT' || openContract.status === 'MANAGEMENT_SIGNED' || openContract.status === 'WAITING_LECTURER';
      setSelectedContract(openContract);
      if (canSign) setSignOpen(true); else setViewOpen(true);
      setOpenId(null); // prevent re-trigger
    }
  }, [openContract]);

  const previewPdfFor = (id) => {
    const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
    window.open(url, '_blank');
  };
  const makePdfFilenameForContract = (contract) => {
    // Prefer lecturer title from contract, then lecturer profile
    const rawTitle = contract?.lecturer?.LecturerProfile?.title
      || contract?.lecturer?.title
      || lecturerProfile?.title
      || authUser?.title
      || '';
    const t = String(rawTitle || '').toLowerCase().replace(/\./g, '').trim();
    const prettyTitle = t === 'dr' ? 'Dr'
      : (t === 'prof' || t === 'professor') ? 'Prof'
      : t === 'mr' ? 'Mr'
      : (t === 'ms' || t === 'miss') ? 'Ms'
      : t === 'mrs' ? 'Mrs'
      : (rawTitle ? String(rawTitle) : '');

    // Base name from various possible fields
    let name = (
      contract?.lecturer_name ||
      contract?.lecturer?.display_name ||
      contract?.lecturer?.full_name ||
      contract?.lecturer?.full_name_english ||
      contract?.lecturer?.fullName ||
      contract?.lecturer?.name ||
      lecturerProfile?.fullName ||
      lecturerProfile?.name ||
      authUser?.fullName ||
      authUser?.name ||
      (authUser?.email ? authUser.email.split('@')[0] : '') ||
      'lecturer'
    ).toString();
    // Strip any title already present to avoid duplication
    name = name.replace(/^(mr|mrs|ms|miss|dr|prof|professor)\.?\s+/i, '').trim();

    const full = (prettyTitle ? `${prettyTitle} ${name}` : name).trim();
    // Sanitize: illegal -> space, compress, then underscores, allow [A-Za-z0-9_.-]
    let safe = full
      .replace(/[\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'lecturer';
    if (!/\.pdf$/i.test(safe)) safe += '.pdf';
    return safe;
  };

  const downloadPdfFor = async (contract) => {
    const id = typeof contract === 'object' ? contract?.id : contract;
    try {
      const res = await axiosInstance.get(`/teaching-contracts/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      // Build filename from lecturer name associated with this contract
      let filename = makePdfFilenameForContract(typeof contract === 'object' ? contract : null);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback: open in new tab if direct download fails
      const url = `${axiosInstance.defaults.baseURL}/teaching-contracts/${id}/pdf`;
      window.open(url, '_blank');
    }
  };
  const formatMDY = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch { return ''; }
  };

  // Helpers to get lecturer info for the card header block
  const getLecturerName = (contract) => (
    contract?.lecturer_name ||
    contract?.lecturer?.fullName ||
    lecturerProfile?.fullName ||
    lecturerProfile?.name ||
    authUser?.fullName ||
    authUser?.name ||
    ''
  );

  const getLecturerEmail = () => (
    lecturerProfile?.email ||
    authUser?.email ||
    ''
  );

  // Department shown is derived from the contract's course(s)
  const getLecturerDepartment = (contract) => {
    const courses = contract?.courses || [];
    const names = courses
      .map((cc) => (
        cc?.Course?.Department?.dept_name ||
        cc?.Course?.Department?.name ||
        cc?.Course?.department_name ||
        cc?.department_name ||
        cc?.departmentName ||
        cc?.department ||
        cc?.major_name ||
        cc?.majorName ||
        cc?.major ||
        cc?.faculty_name ||
        cc?.facultyName ||
        ''
      ))
      .map((s) => (s || '').toString().trim())
      .filter(Boolean);
    const unique = Array.from(new Set(names));
    return unique.join(', ');
  };

  const statusLabel = (s) => {
    // s is a display status: WAITING_LECTURER | WAITING_MANAGEMENT | COMPLETED | CONTRACT_ENDED | DRAFT
    switch (s) {
      case 'WAITING_LECTURER':
  return { label: 'waiting lecturer', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'WAITING_MANAGEMENT':
  return { label: 'waiting management', class: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock };
      case 'COMPLETED':
  return { label: 'completed', class: 'bg-green-50 text-green-700 border-green-200', icon: CircleCheck };
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
      case 'WAITING_LECTURER':
        return 'WAITING_LECTURER';
      case 'LECTURER_SIGNED':
      case 'WAITING_MANAGEMENT':
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
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">My Contracts</h1>
            <p className="text-gray-600">Review, sign, and download your contracts</p>
          </div>
        </div>
      </div>

      {/* Pending contracts card */}
      {pendingCount > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/40">
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
              const dept = getLecturerDepartment(c);
              return (
                <div className="rounded-xl border border-amber-200 bg-white/70 backdrop-blur px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
                  {/* overflow menu mount point (hidden for now) */}
                  
                  {/* Left: details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-gray-900">{formattedId}</span>
                    </div>
                    <div className="text-sm text-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      <div><span className="text-gray-600">Period:</span> {period}</div>
                      <div className="truncate" title={dept || '—'}><span className="text-gray-600">Department:</span> {dept || '—'}</div>
                      <div><span className="text-gray-600">Hours:</span> {hours}h</div>
                      <div><span className="text-gray-600">Rate:</span> {rate != null ? `$${rate}/hr` : '—'}</div>
                      <div className="sm:col-span-2"><span className="text-gray-600">Total:</span> {rate != null ? `$${Math.round(rate * hours).toLocaleString()}` : '—'}</div>
                    </div>
                  </div>
                  {/* Right: actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => previewPdfFor(c.id)} title="Preview contract" className="border-amber-200"><Eye className="w-4 h-4"/> Review</Button>
                    <Button size="sm" onClick={() => { setSelectedContract(c); setSignOpen(true); }} className="bg-amber-600 hover:bg-amber-700"><PenTool className="w-4 h-4"/> Sign Now</Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* All contracts card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600"/>
            <CardTitle>All My Contracts ({total})</CardTitle>
          </div>
          <CardDescription>Complete history of your lecturer contracts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border bg-white overflow-x-auto w-full">
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span>Status</span>
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    value={statusFilter}
                    onValueChange={(v)=> setStatusFilter(v)}
                    placeholder="All statuses"
                    className="w-full"
                    buttonClassName="h-11 text-base"
                  >
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="WAITING_LECTURER">Waiting Lecturer</SelectItem>
                    <SelectItem value="WAITING_MANAGEMENT">Waiting Management</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CONTRACT_ENDED">Contract Ended</SelectItem>
                  </Select>
                </div>
              </div>
              <div className="ml-auto text-sm text-gray-600 hidden md:block">
                {loading ? (
                  <span className="inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin"/> Loading…</span>
                ) : (
                  `${(filteredContracts?.length||0)} of ${total}`
                )}
              </div>
            </div>
            <div className="px-4 py-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {(filteredContracts || []).map(c => {
                const createdYear = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
                const formattedId = `CTR-${createdYear}-${String(c.id).padStart(3, '0')}`;
                const hours = (c.courses || []).reduce((a, cc) => a + (cc.hours || 0), 0);
                const startDate = c.start_date || c.startDate || null;
                const endDate = c.end_date || c.endDate || null;
                const hasBothDates = !!(startDate && endDate);
                const rate = hourlyRate; // from lecturer profile
                const totalValue = rate != null ? rate * hours : null;
                const displayStatus = getDisplayStatus(c);
                const st = statusLabel(displayStatus);
                const canSign = c.status === 'MANAGEMENT_SIGNED' || c.status === 'WAITING_LECTURER';
                const deptDisplay = getLecturerDepartment(c);

                return (
                  <div key={c.id} className="h-full">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm flex flex-col h-full relative group transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5">
                    {/* Header: CTR ID and overflow menu */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-gray-900 text-sm md:text-base">{formattedId}</span>
                        </div>
                        <button
                          type="button"
                          data-ellipsis
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(prev => prev === c.id ? null : c.id); }}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          title="More"
                          aria-label="More actions"
                        >
                          <Ellipsis className="w-4 h-4" />
                        </button>
                        {menuOpenId === c.id && (
                          <div
                            data-menu
                            className="absolute z-20 right-2 top-10 w-44 rounded-md border border-gray-200 bg-white shadow-lg py-1"
                          >
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              onClick={() => { previewPdfFor(c.id); setMenuOpenId(null); }}
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                              <span>View Contract</span>
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              onClick={() => { downloadPdfFor(c); setMenuOpenId(null); }}
                            >
                              <Download className="w-4 h-4 text-gray-500" />
                              <span>Download PDF</span>
                            </button>
                            <div className="my-1 border-t border-gray-100" />
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-orange-600"
                              onClick={() => { setSelectedContract(c); setViewOpen(true); setMenuOpenId(null); }}
                            >
                              <Info className="w-4 h-4 text-orange-500" />
                              <span>View Detail</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Lecturer info */}
                      <div className="mb-3">
                        <div className="grid grid-cols-[16px_1fr] items-center gap-3">
                          <User2 className="w-4 h-4 text-gray-500" />
                          <div className="min-w-0">
                            <div className="text-gray-900 font-medium truncate">{getLecturerName(c) || '—'}</div>
                            <div className="text-xs text-gray-600 truncate" title={getLecturerEmail() || '—'}>{getLecturerEmail() || '—'}</div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-[16px_1fr] items-center gap-3">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <div className="text-xs text-gray-700 truncate min-w-0" title={deptDisplay || '—'}>{deptDisplay || '—'}</div>
                        </div>

                      </div>  

                      {/* Contract Period */}
                      <div className="mb-3">
                        <div className="flex items-center gap-3 text-gray-800">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Contract Period</span>
                        </div>
                        <div className="text-sm text-gray-900">
                          {hasBothDates ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold">{formatMDY(startDate)}</div>
                              <div className="text-gray-500">to</div>
                              <div>{formatMDY(endDate)}</div>
                            </div>
                          ) : (
                            <span>{`Term ${c.term} • ${c.academic_year}`}</span>
                          )}
                        </div>
                      </div>

                      {/* Financial Details */}
                      <div className="mb-2">
                        <div className="flex items-center gap-3 text-gray-800">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Financial Details</span>
                        </div>
                        <div className="text-sm text-gray-900 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Rate:</span>
                            <span className="font-medium">{rate != null ? `$${rate}/hr` : '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Hours:</span>
                            <span className="font-semibold">{hours}h</span>
                          </div>
                          <div className="border-t my-1" />
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Total:</span>
                            <span className="font-semibold text-green-600">{totalValue != null ? `$${Math.round(totalValue).toLocaleString()}` : '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom bar: status (left) + actions (right) */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${st.class}`}>
                        {st.icon && <st.icon className="w-3.5 h-3.5" />}
                        {st.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => previewPdfFor(c.id)}
                          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                          title="Preview"
                          aria-label="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canSign && (
                          <button
                            onClick={() => { setSelectedContract(c); setSignOpen(true); }}
                            className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            title="Sign"
                            aria-label="Sign"
                          >
                            <PenTool className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => downloadPdfFor(c)}
                          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                          title="Download"
                          aria-label="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                );
              })}

              {loading && (
                <div className="w-full py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading contracts…
                  </div>
                </div>
              )}

              {(!contracts || contracts.length === 0) && !loading && (
                <div className="w-full py-12">
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <FileText className="h-10 w-10 text-gray-300" />
                    <div className="text-gray-900 font-medium">No contracts found</div>
                    <div className="text-gray-500 text-sm">You’ll see your contracts here once they are generated</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* View Contract Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden relative">
          <button
            type="button"
            onClick={() => setViewOpen(false)}
            className="absolute right-3 top-3 p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Contract Details {selectedContract ? `- CTR-${(selectedContract.created_at ? new Date(selectedContract.created_at).getFullYear() : new Date().getFullYear())}-${String(selectedContract.id).padStart(3,'0')}` : ''}</DialogTitle>
            <DialogDescription>Review your contract terms and assignments</DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="px-6 pb-6 pt-2 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Period:</span> {formatMDY(selectedContract.start_date)} - {formatMDY(selectedContract.end_date)}</div>
                  <div>
                    <span className="font-medium">Rate:</span>{' '}
                    {(() => {
                      const r = selectedContract?.hourly_rate ?? selectedContract?.hourlyRate ?? hourlyRate;
                      return r != null ? `$${r}/hr` : '-';
                    })()}
                  </div>
                  <div><span className="font-medium">Total Hours:</span> {(selectedContract.courses || []).reduce((a,c)=>a+(c.hours||0),0)}</div>
                  <div>
                    <span className="font-medium">Total Value:</span>{' '}
                    {(() => {
                      const r = selectedContract?.hourly_rate ?? selectedContract?.hourlyRate ?? hourlyRate;
                      if (r == null) return '-';
                      const h = (selectedContract.courses || []).reduce((a,c)=>a+(c.hours||0),0);
                      return `$${Math.round(r * h).toLocaleString()}`;
                    })()}
                  </div>
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
        <DialogContent className="w-[95vw] sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="flex items-center gap-2"><PenTool className="w-4 h-4"/> Sign Contract</DialogTitle>
            <DialogDescription>Provide your digital signature to accept this contract</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
              By signing this contract, you agree to all terms and conditions outlined in the document.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setSignOpen(false)} className="h-10 px-4 min-w-[160px]">Cancel</Button>
              <label className={`inline-flex items-center gap-2 ${uploading ? 'opacity-70' : 'cursor-pointer'}`}>
                <input type="file" className="hidden" accept="image/*" onChange={async (e)=> { if (selectedContract) { await uploadSignature(selectedContract.id, e.target.files[0]); setSignOpen(false); } }} disabled={uploading} />
                <span className="h-10 px-4 min-w-[160px] border rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center justify-center">
                  {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                  Upload Signature
                </span>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
