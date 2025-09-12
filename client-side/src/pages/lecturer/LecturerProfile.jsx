import React, { useEffect, useState, useMemo } from 'react';
import { axiosInstance } from '../../lib/axios';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Label from '../../components/ui/Label';
import toast from 'react-hot-toast';
import { User, BookOpen, FileText, Shield, Lock, Wallet, Upload, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';

const avatarColors = ['bg-blue-600','bg-indigo-600','bg-emerald-600','bg-rose-600','bg-amber-600'];

export default function LecturerProfile(){
  const [profile,setProfile] = useState(null);
  const [form,setForm] = useState({});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [fileUploading,setFileUploading] = useState(false);
  const [editMode,setEditMode] = useState(false);
  const [errors,setErrors] = useState({});
  const [passwordForm,setPasswordForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [passwordSaving,setPasswordSaving] = useState(false);
  // password visibility toggles and small click animation flags
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [animCurrent, setAnimCurrent] = useState(false);
  const [animNew, setAnimNew] = useState(false);
  const [animConfirm, setAnimConfirm] = useState(false);
  const [showSyllabusDialog,setShowSyllabusDialog] = useState(false);
  const [syllabusFile,setSyllabusFile] = useState(null);

  useEffect(()=>{(async()=>{
    try {
      const res = await axiosInstance.get('/lecturer-profile/me');
      setProfile(res.data);
      setForm(mapProfileToForm(res.data));
    } catch(e){
      toast.error(e.response?.data?.message || 'Failed to load profile');
    } finally { setLoading(false); }
  })(); },[]);

  const mapProfileToForm = (p)=>({
    full_name_english: p.full_name_english || '',
    full_name_khmer: p.full_name_khmer || '',
    personal_email: p.personal_email || '',
    phone_number: p.phone_number || '',
    place: p.place || '',
    latest_degree: p.latest_degree || '',
    degree_year: p.degree_year || '',
    major: p.major || '',
    university: p.university || '',
    country: p.country || '',
    qualifications: p.qualifications || '',
    research_fields: (p.research_fields || ''),
    short_bio: p.short_bio || '',
    bank_name: p.bank_name || '',
    account_name: p.account_name || '',
    account_number: p.account_number || '',
    hourlyRateThisYear: p.hourlyRateThisYear ?? '',
  });

  const sanitizeEnglish = (s='') => String(s).replace(/[^A-Za-z' -]/g, '');
  // Allow Khmer characters (U+1780 - U+17FF) and spaces only
    const sanitizeKhmer = (s='') => String(s).replace(/[^\u1780-\u17FF\s]/g, '');

  const onChange = (e)=>{
    const { name,value } = e.target;
    let newValue = value;
    if(name === 'full_name_english'){
      newValue = sanitizeEnglish(value);
    } else if (name === 'full_name_khmer') {
      newValue = sanitizeKhmer(value);
    } else if (name === 'short_bio') {
      // enforce max 160 characters while typing
      newValue = String(value).slice(0, 160);
    }
    setForm(f=>({...f,[name]:newValue }));
    if(errors[name]) setErrors(er=>({...er,[name]:null}));
  };

  const onPaste = (e)=>{
    const name = e.target.name;
    if(name === 'full_name_english' || name === 'full_name_khmer' || name === 'short_bio'){
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
      const target = e.target;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const current = target.value || '';
      let cleaned;
      if(name === 'full_name_english') cleaned = sanitizeEnglish(paste);
      else if(name === 'full_name_khmer') cleaned = sanitizeKhmer(paste);
      else {
        // short_bio: allow any text but cap to remaining characters
        const maxAllowed = Math.max(0, 160 - (current.length - (end - start)));
        cleaned = String(paste).slice(0, maxAllowed);
      }
      const newVal = current.slice(0,start) + cleaned + current.slice(end);
      setForm(f=>({...f,[name]:newVal}));
      if(errors[name]) setErrors(er=>({...er,[name]:null}));
    }
  };

  const validate = ()=>{
    const er={};
    if(!form.full_name_english.trim()) er.full_name_english='Required';
  // personal_email no longer edited here; validation removed
    if(form.phone_number && !/^[0-9+\-() ]{6,20}$/.test(form.phone_number)) er.phone_number='Invalid phone';
    if(form.degree_year && (Number(form.degree_year)<1950 || Number(form.degree_year)> new Date().getFullYear())) er.degree_year='Out of range';
    setErrors(er); return Object.keys(er).length===0;
  };

  const save = async ()=>{
    if(!validate()) { toast.error('Fix validation errors'); return; }
    setSaving(true);
    try {
  const { hourlyRateThisYear, ...rest } = form;
  const payload = { ...rest, research_fields: form.research_fields };
      const res = await axiosInstance.put('/lecturer-profile/me', payload);
      setProfile(res.data.profile || res.data); // handle either shape
      toast.success('Profile updated');
      setEditMode(false);
    } catch(e){
      toast.error(e.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const cancel = ()=>{ setForm(mapProfileToForm(profile)); setEditMode(false); setErrors({}); };

  const changePassword = async ()=>{
    if(!passwordForm.currentPassword || !passwordForm.newPassword){ toast.error('Fill all password fields'); return; }
    if(passwordForm.newPassword !== passwordForm.confirm){ toast.error('Passwords do not match'); return; }
    if(passwordForm.newPassword.length<6){ toast.error('Password too short'); return; }
    setPasswordSaving(true);
    try {
      await axiosInstance.post('/profile/change-password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      toast.success('Password updated');
      setPasswordForm({ currentPassword:'', newPassword:'', confirm:'' });
    } catch(e){
      toast.error(e.response?.data?.message || 'Password change failed');
    } finally { setPasswordSaving(false); }
  };

  const uploadFiles = async (files)=>{
    if(!files.cv && !files.syllabus) return;
    const fd = new FormData();
    if(files.cv) fd.append('cv', files.cv);
    if(files.syllabus) fd.append('syllabus', files.syllabus);
    setFileUploading(true);
    try {
      const res = await axiosInstance.post('/lecturer-profile/me/files', fd, { headers: { 'Content-Type':'multipart/form-data' } });
      setProfile(res.data.profile || res.data);
      toast.success('Files uploaded');
    } catch(e){
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally { setFileUploading(false); }
  };

  // Research fields editing removed with Academic & Professional card.

  return (
  <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {loading && (
        <div className="space-y-8 animate-pulse">
          <div className="h-44 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-80 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-80 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-64 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-64 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
          </div>
        </div>
      )}
      {!loading && profile && (
        <>
          {/* Overview Card */}
          <Card className="shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100/70 bg-white/90 backdrop-blur rounded-2xl overflow-hidden group">
            <CardContent className="p-6 md:p-10">
      <div className="flex flex-col xl:flex-row gap-10 items-start xl:items-center">
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <Avatar name={profile.full_name_english || profile.user_display_name || 'Lecturer'} />
                  <div className="space-y-1.5">
        <h1 className="text-2xl md:text-[2rem] font-semibold leading-tight text-gray-900 tracking-tight flex items-center gap-3 break-words">
                      <span>{profile.full_name_english || 'Unnamed Lecturer'}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm">Profile</span>
                    </h1>
                    {profile.full_name_khmer && (
                      <p className="text-lg md:text-xl font-medium text-indigo-600/90 leading-snug tracking-wide drop-shadow-sm">{profile.full_name_khmer}</p>
                    )}
                    <p className="text-[11px] inline-flex items-center gap-1.5 bg-indigo-50/70 text-indigo-700 px-2.5 py-1 rounded-full tracking-wide shadow-sm ring-1 ring-indigo-100"> <Shield className="h-3.5 w-3.5" /> {profile.position}</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 text-[13px] mt-4 md:mt-0">
                  <OverviewItem label="Status" value={<StatusBadge status={profile.status} />} />
                  <OverviewItem label="Employee ID" value={profile.employee_id} />
                  <OverviewItem label="Department" value={profile.department_name || '—'} />
                  <OverviewItem label="Join Date" value={new Date(profile.join_date).toLocaleDateString()} />
                </div>
                <div className="xl:ml-auto flex flex-col sm:flex-row gap-2 mt-4 xl:mt-0 w-full xl:w-auto">
                  {editMode ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={cancel} disabled={saving} className="w-full sm:w-auto">Cancel</Button>
                      <Button size="sm" onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">{saving?'Saving...':'Save'}</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={()=>setEditMode(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm group-hover:shadow-md transition-shadow w-full sm:w-auto">Edit Profile</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information only (Academic & Professional card removed) */}
          <div>
            <Card className="shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/95 backdrop-blur rounded-2xl border border-gray-100/70">
              <SectionHeader title="Personal Information" icon={<User className="h-4 w-4" />} accent="blue" />
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <Field name="full_name_english" label="Full Name (English)" value={form.full_name_english} onChange={onChange} onPaste={onPaste} error={errors.full_name_english} disabled={!editMode} />
                  <Field name="full_name_khmer" label="Full Name (Khmer)" value={form.full_name_khmer} onChange={onChange} disabled={!editMode} />
                  <Field name="phone_number" label="Contact Number" value={form.phone_number} onChange={onChange} disabled={!editMode} error={errors.phone_number} />
                  <div className="md:col-span-2 xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
                    <ReadOnly label="School Email" value={profile.user_email || profile.email || ''} />
                    <ReadOnly label="Position" value={profile.position || profile.occupation || ''} />
                    <ReadOnly label="Hourly Rate This Year ($)" value={form.hourlyRateThisYear || ''} />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Field name="short_bio" label="Short Bio" as="textarea" value={form.short_bio} onChange={onChange} onPaste={onPaste} disabled={!editMode} />
                    {editMode && (
                      <p className="text-xs text-gray-500 mt-1">{(form.short_bio||'').length}/160 characters</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Courses & Documents */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/95 backdrop-blur rounded-2xl border border-gray-100/70">
              <SectionHeader title="Courses Taught" icon={<BookOpen className="h-4 w-4" />} accent="amber" />
              <CardContent className="pt-5 text-sm">
                <p className="text-[11px] text-gray-500 mb-4 flex items-center gap-2"><span className="inline-block h-1 w-1 rounded-full bg-amber-400" />Captured during onboarding</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Departments</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.departments?.length ? profile.departments.map(d=> {
                        const id = d.id || d.name || d;
                        const name = d.name || d;
                        return (
                          <span key={id} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/70 text-amber-700 shadow-sm">
                            {name}
                          </span>
                        );
                      }) : <span className="text-xs text-gray-400 italic">No departments recorded</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Courses</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.courses?.length ? profile.courses.map(c=> {
                        const id = c.id || c.name || c;
                        const name = c.name || c;
                        const code = c.code || '';
                        return (
                          <span key={id} title={code} className="px-2.5 py-1 rounded-md text-[11px] bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/70 shadow-sm text-gray-700 flex items-center gap-1">
                            {code && <span className="text-[10px] text-indigo-600 font-semibold">{code}</span>}{name}
                          </span>
                        );
                      }) : <span className="text-xs text-gray-400 italic">No courses recorded</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/95 backdrop-blur rounded-2xl border border-gray-100/70">
              <SectionHeader title="Documents" icon={<FileText className="h-4 w-4" />} accent="emerald" />
              <CardContent className="pt-5 space-y-4">
                <DocRow label="Curriculum Vitae (CV)" exists={!!profile.cv_file_path} url={profile.cv_file_path} onUpload={(f)=>uploadFiles({ cv:f })} uploading={fileUploading} editable={editMode} />
                {profile.course_syllabus ? (
                  <DocRow label="Course Syllabus" exists={!!profile.course_syllabus} url={profile.course_syllabus} onUpload={(f)=>uploadFiles({ syllabus:f })} uploading={fileUploading} editable={editMode} />
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-sm p-4 rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-white to-gray-50/70">
                    <div className="w-full sm:w-auto">
                      <p className="font-medium text-gray-800 flex items-center gap-2 tracking-wide">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-300 shadow" />
                        Course Syllabus <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider">Required</span>
                      </p>
                      <p className="text-[11px] mt-1 text-gray-400">Not uploaded</p>
                    </div>
                    <Button type="button" size="sm" className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1 shadow-sm w-full sm:w-auto" onClick={()=>setShowSyllabusDialog(true)}>
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Banking & Account Settings */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/95 backdrop-blur rounded-2xl border border-gray-100/70">
                <SectionHeader title="Banking" icon={<Wallet className="h-4 w-4" />} accent="purple" />
                <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field name="bank_name" label="Bank Name" value={form.bank_name} onChange={onChange} disabled={!editMode} />
                  <Field name="account_name" label="Account Name" value={form.account_name} onChange={onChange} disabled={!editMode} />
                  <Field name="account_number" label="Account Number" value={form.account_number} onChange={onChange} disabled={!editMode} />
                </CardContent>
              </Card>
              <Card className="shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/95 backdrop-blur rounded-2xl border border-gray-100/70">
                <SectionHeader title="Account Settings" icon={<Lock className="h-4 w-4" />} accent="red" />
                <CardContent className="pt-5 space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-gray-600">Current Password</Label>
                    <div className="relative">
                      <Input id="currentPassword" name="currentPassword" type={showCurrent ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={e=>setPasswordForm(f=>({...f,currentPassword:e.target.value}))} placeholder="••••••" className="pr-10" />
                      <button
                        type="button"
                        aria-label="Toggle current password visibility"
                        onClick={()=>{ setShowCurrent(s=>!s); setAnimCurrent(true); setTimeout(()=>setAnimCurrent(false),200); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {showCurrent ? <Eye className={`h-4 w-4 transition-transform ${animCurrent ? 'scale-110 rotate-12' : ''}`} /> : <EyeOff className={`h-4 w-4 transition-transform ${animCurrent ? 'scale-110 rotate-12' : ''}`} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-gray-600">New Password</Label>
                    <div className="relative">
                      <Input id="newPassword" name="newPassword" type={showNew ? 'text' : 'password'} value={passwordForm.newPassword} onChange={e=>setPasswordForm(f=>({...f,newPassword:e.target.value}))} placeholder="At least 6 characters" className="pr-10" />
                      <button
                        type="button"
                        aria-label="Toggle new password visibility"
                        onClick={()=>{ setShowNew(s=>!s); setAnimNew(true); setTimeout(()=>setAnimNew(false),200); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {showNew ? <Eye className={`h-4 w-4 transition-transform ${animNew ? 'scale-110 rotate-12' : ''}`} /> : <EyeOff className={`h-4 w-4 transition-transform ${animNew ? 'scale-110 rotate-12' : ''}`} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-gray-600">Confirm New Password</Label>
                    <div className="relative">
                      <Input id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={passwordForm.confirm} onChange={e=>setPasswordForm(f=>({...f,confirm:e.target.value}))} placeholder="Repeat new password" className="pr-10" />
                      <button
                        type="button"
                        aria-label="Toggle confirm password visibility"
                        onClick={()=>{ setShowConfirm(s=>!s); setAnimConfirm(true); setTimeout(()=>setAnimConfirm(false),200); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {showConfirm ? <Eye className={`h-4 w-4 transition-transform ${animConfirm ? 'scale-110 rotate-12' : ''}`} /> : <EyeOff className={`h-4 w-4 transition-transform ${animConfirm ? 'scale-110 rotate-12' : ''}`} />}
                      </button>
                    </div>
                  </div>
                  <Button type="button" onClick={changePassword} disabled={passwordSaving}>{passwordSaving?'Updating...':'Update Password'}</Button>
                </CardContent>
              </Card>
            </div>
        </>
      )}
      {/* Syllabus Upload Modal */}
      <Dialog open={showSyllabusDialog} onOpenChange={setShowSyllabusDialog}>
        <DialogContent className="w-[92vw] max-w-md sm:w-auto">
          <DialogHeader>
            <DialogTitle>Upload Course Syllabus</DialogTitle>
            <DialogDescription>Attach a PDF syllabus. This will be stored in your personal folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept="application/pdf"
                onChange={e=> setSyllabusFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />
              {syllabusFile && <p className="mt-2 text-xs text-gray-600">Selected: {syllabusFile.name}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={()=>{ setShowSyllabusDialog(false); setSyllabusFile(null); }} disabled={fileUploading}>Cancel</Button>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={!syllabusFile || fileUploading}
                onClick={async()=>{
                  if(!syllabusFile) return; 
                  await uploadFiles({ syllabus: syllabusFile });
                  setShowSyllabusDialog(false); setSyllabusFile(null);
                }}
              >{fileUploading? 'Uploading...':'Upload'}</Button>
            </div>
            <p className="text-[11px] text-gray-500">Accepted format: PDF only. Max size may be limited by server settings.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }){
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b pb-1">{title}</h2>
      {children}
    </div>
  );
}

function Field({ name,label,value,onChange,disabled,as,options,type='text',error, onPaste, readOnly }){
  return (
    <div className="space-y-1 flex flex-col justify-end">
      <Label htmlFor={name} className="text-xs font-medium text-gray-600">{label}</Label>
  {as==='textarea' && <Textarea id={name} name={name} value={value} onChange={onChange} onPaste={onPaste} disabled={disabled} readOnly={readOnly} className="bg-white w-full" rows={4} />}
      {as==='select' && (
        <select id={name} name={name} value={value} onChange={onChange} onPaste={onPaste} disabled={disabled} readOnly={readOnly} className="w-full border rounded px-2 py-1 text-sm bg-white disabled:opacity-60">
          <option value="">Select...</option>
          {options.map(o=> <option key={o} value={o}>{o}</option>)}
        </select>
      )}
  {!as && <Input id={name} name={name} value={value} onChange={onChange} onPaste={onPaste} disabled={disabled} readOnly={readOnly} type={type} className="bg-white w-full" />}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReadOnly({ label, value }){
  return (
    <div className="space-y-1 group">
      <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">{label}{value && <span className="text-[9px] uppercase tracking-wide text-indigo-500/70 font-semibold">Read only</span>}</Label>
  <div className="text-sm bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg px-2.5 py-1.5 min-h-[42px] flex items-center font-medium text-gray-700 group-hover:border-gray-300 transition-colors select-text shadow-inner break-words">{value || '—'}</div>
    </div>
  );
}

// AddResearchField component removed with Academic card.

function FileCard({ title, exists, url, onUpload, uploading, disabled }){
  const handleFile = (e)=>{ const file=e.target.files?.[0]; if(file) onUpload(file); };
  return (
    <div className="border rounded p-4 space-y-2">
      <p className="font-medium text-sm">{title}</p>
      <div className="flex items-center gap-2 text-xs">
        {exists ? <span className="text-green-600">Uploaded</span> : <span className="text-gray-400">Not uploaded</span>}
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>}
      </div>
      <div>
        <input type="file" accept="application/pdf" onChange={handleFile} disabled={disabled || uploading} className="text-xs" />
      </div>
    </div>
  );
}

function Avatar({ name }){
  const initials = name.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
  const color = useMemo(()=> avatarColors[initials.charCodeAt(0)%avatarColors.length], [initials]);
  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-tr from-indigo-500 via-blue-500 to-emerald-500 rounded-full blur opacity-60 group-hover:opacity-90 transition" />
  <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white text-xl font-semibold shadow-lg ring-4 ring-white ${color}`}>{initials||'L'}</div>
    </div>
  );
}

function OverviewItem({ label, value, dark }){
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wide font-medium ${dark? 'text-white/60':'text-gray-400'}`}>{label}</p>
      <div className={`text-sm font-medium mt-0.5 ${dark? 'text-white':'text-gray-700'}`}>{value || '—'}</div>
    </div>
  );
}

function StatusBadge({ status, dark }){
  const isActive = status==='active';
  const base = dark
    ? (isActive ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40' : 'bg-white/15 text-white/70 ring-1 ring-white/20')
    : (isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600');
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur ${base}`}>{status}</span>;
}

function SectionHeader({ title, icon, accent='indigo' }){
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-red-600 bg-red-50',
    indigo: 'text-indigo-600 bg-indigo-50'
  };
  const styles = colorMap[accent] || colorMap.indigo;
  return (
    <div className="border-b px-6 pt-4 bg-gradient-to-r from-white via-gray-50 to-white relative">
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-500/70 via-blue-500/60 to-emerald-500/70 rounded-tr-full rounded-br-full" />
      <h2 className="text-[13px] font-semibold text-gray-700 pb-3 flex items-center gap-2 tracking-wide">
        <span className={`h-7 w-7 rounded-full flex items-center justify-center ${styles} shadow-sm ring-1 ring-white`}>{icon}</span>
        <span>{title}</span>
      </h2>
    </div>
  );
}

function DocRow({ label, exists, url, onUpload, uploading, editable }){
  const downloadUrl = exists ? buildFileUrl(url) : null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-sm p-4 rounded-xl border border-dashed border-gray-200 hover:border-gray-300 transition-colors bg-gradient-to-br from-white to-gray-50/70 group">
      <div className="w-full sm:w-auto">
        <p className="font-medium text-gray-800 flex items-center gap-2 tracking-wide">
          {exists ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow" /> : <span className="inline-block w-2 h-2 rounded-full bg-gray-300 shadow-inner" />}
          {label}
        </p>
        <p className={`text-[11px] mt-1 ${exists ? 'text-emerald-600 font-medium' : 'text-gray-400 italic'}`}>{exists? 'Uploaded' :'Not uploaded'}</p>
      </div>
      <div className="flex items-center flex-wrap gap-2">
        {exists && (
          <a
            href={downloadUrl}
            download
            className="text-xs bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-3 py-1.5 rounded-md font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Download
          </a>
        )}
        {editable && <label className="text-xs cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md font-medium shadow-sm border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500">
          <input type="file" className="hidden" accept="application/pdf" onChange={e=>{ const f=e.target.files?.[0]; if(f) onUpload(f); }} disabled={uploading} />
          {uploading? 'Uploading...':'Upload'}
        </label>}
      </div>
    </div>
  );
}


// Convert backend-relative stored path (e.g. uploads/lecturers/NAME/cv.pdf) to absolute URL on API host
function buildFileUrl(p){
  if(!p) return '';
  if(/^https?:/i.test(p)) return p; // already full URL
  const cleaned = p.replace(/\\/g,'/').replace(/^\//,'');
  // axiosInstance baseURL ends with /api; strip that to get origin
  let base = axiosInstance.defaults.baseURL || '';
  base = base.replace(/\/?api\/?$/i,'');
  if(base.endsWith('/')) base = base.slice(0,-1);
  return `${base}/${cleaned}`;
}
