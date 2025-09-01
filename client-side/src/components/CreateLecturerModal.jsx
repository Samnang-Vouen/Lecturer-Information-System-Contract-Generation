import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

export default function CreateLecturerModal({ isOpen, onClose, onLecturerCreated }) {
  const [formData, setFormData] = useState({ fullName: '', email: '', position: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleChange = e => {
    const { name, value } = e.target;
    
    // For fullName, only allow English letters, spaces, periods, and common titles
    if (name === 'fullName') {
      // Allow only English letters (a-z, A-Z), spaces, periods, apostrophes, and hyphens
      const englishOnly = value.replace(/[^a-zA-Z\s.''-]/g, '');
      setFormData(p => ({ ...p, [name]: englishOnly }));
    } else {
      setFormData(p => ({ ...p, [name]: value }));
    }
    
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) {
      errs.fullName = 'Full name required';
    } else if (!/^[a-zA-Z\s.''-]+$/.test(formData.fullName.trim())) {
      errs.fullName = 'Name must contain only English letters and common titles (Dr., Mr., Mrs., etc.)';
    } else if (formData.fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters long';
    }
    
    if (!formData.email.trim()) errs.email = 'Email required';
    else if (!/^[A-Z0-9._%+-]+@cadt\.edu\.kh$/i.test(formData.email)) errs.email = 'Must be CADT email';
    if (!formData.position.trim()) errs.position = 'Position required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
  // Backend route should inject role & a default department, but send explicitly for robustness
  const payload = { fullName: formData.fullName, email: formData.email, position: formData.position }; // role & department inferred server-side
  const res = await axiosInstance.post('/lecturers', payload);
      setSuccessData(res.data);
      onLecturerCreated(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create lecturer';
      toast.error(msg);
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
    } finally { setIsSubmitting(false); }
  };

  const handleClose = () => { setFormData({ fullName:'', email:'', position:'' }); setErrors({}); setSuccessData(null); onClose(); };

  useEffect(()=>{ if(isOpen){ const o=document.body.style.overflow; document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow=o; }; } },[isOpen]);
  if(!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl pointer-events-auto relative">
          <button onClick={handleClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
          {successData ? (
            <div>
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <h2 className="text-xl font-semibold">Lecturer Created</h2>
                  <p className="text-sm text-gray-600 mt-1">Temporary password generated. Share securely.</p>
                </div>
              </div>
              <div className="border rounded-md p-4 mb-6 bg-gray-50">
                <p className="text-sm font-medium mb-2">Temp Password</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tracking-wider select-none">••••••••••</span>
                  <button
                    type="button"
                    onClick={()=>{ navigator.clipboard.writeText(successData.tempPassword); toast.success('Copied'); }}
                    className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-100"
                  >Copy</button>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Masked for security. Use Copy to share privately.</p>
              </div>
              <button onClick={handleClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md">Close</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-xl font-semibold">Add Lecturer</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.fullName?'border-red-500':'border-gray-300'}`} 
                  placeholder="Dr. John Smith or Prof. Jane Doe" 
                />
                {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>}
                <p className="text-xs text-gray-500 mt-1">English letters only. Include titles like Dr., Prof., Mr., Mrs. if applicable.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email?'border-red-500':'border-gray-300'}`} placeholder="name@cadt.edu.kh" />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select name="position" value={formData.position} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.position?'border-red-500':'border-gray-300'}`}>
                  <option value="">Select Position</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Teaching Assistant (TA)">Teaching Assistant (TA)</option>
                </select>
                {errors.position && <p className="text-xs text-red-600 mt-1">{errors.position}</p>}
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-md flex items-center justify-center">
                  {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Creating...</>) : 'Create Lecturer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>, document.body);
}
