import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
// Dynamic catalogs from backend instead of local static data
import axiosInstance from '../../lib/axios';
import { useResearchFields } from '../../hooks/useResearchFields';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Label from '../../components/ui/Label';
import Textarea from '../../components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useUniversities } from '../../hooks/useUniversities';
import { useMajors } from '../../hooks/useMajors';
import {
  User,
  GraduationCap,
  Briefcase,
  Phone,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  FileText,
  Search
} from 'lucide-react';
import countries from 'world-countries';

const steps = [
  { id: 1, title: "Basic Information", icon: User, description: "Personal and banking details" },
  { id: 2, title: "Academic Info", icon: GraduationCap, description: "Course and research information" },
  { id: 3, title: "Education", icon: GraduationCap, description: "Educational background" },
  { id: 4, title: "Professional", icon: Briefcase, description: "Work experience" },
  { id: 5, title: "Contact", icon: Phone, description: "Contact information" },
];

export default function Onboarding(){
  // Helper to title-case names like "spider man" => "Spider Man"
  const toTitleCase = (str='') => str
    .trim()
    .split(/\s+/)
    .map(w=> w ? w[0].toUpperCase()+w.slice(1).toLowerCase() : '')
    .join(' ');
  // Normalize title and compose "Title. Name"; avoid duplicating title if already present
  const TITLE_MAP = useMemo(() => ({ Mr: 'Mr.', Ms: 'Ms.', Mrs: 'Mrs.', Dr: 'Dr.', Prof: 'Prof.' }), []);
  const composeEnglishWithTitle = (rawTitle, rawName) => {
    const name = toTitleCase(String(rawName || ''));
    const t = rawTitle && TITLE_MAP[rawTitle] ? TITLE_MAP[rawTitle] : (rawTitle ? String(rawTitle).trim() : '');
    if (!t) return name;
    // If name already starts with the title (with or without dot), normalize to mapped form
    const bare = String(rawTitle || '').replace(/\./g, '');
    const re = new RegExp(`^\s*(${bare}|${bare}\.)\s+`, 'i');
    if (re.test(name)) {
      return name.replace(re, `${t} `).trim();
    }
    return `${t}${name ? ' ' + name : ''}`.trim();
  };
  const { authUser } = useAuthStore();
  const { researchFields: researchFieldsAPI, createResearchField } = useResearchFields();
  const { universities } = useUniversities();
  const { majors } = useMajors();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Basic Info
    englishName: '',
    khmerName: '',
    accountName: '',
    bankName: 'ACLEDA Bank',
    accountHolderName: '',
    
    // Academic Info
  // courseTitle removed
  shortBio: '',
  researchFields: [],
  departments: [], // selected departments
  courses: [], // selected course names
    
    // Education
    universityName: '',
    country: '',
    majorName: '',
    graduationYear: '',
    latestDegree: '',
    
    // Professional
    occupation: '',
    placeOfWork: '',
    
    // Contact
    phoneNumber: '',
    personalEmail: '',
    schoolEmail: ''
  });

  // Keep a normalized E.164 phone value for validation/submission
  const [phoneE164, setPhoneE164] = useState('');

  // Auto-fill school email from logged in user and keep it stable/read-only
  useEffect(()=>{
    if(authUser?.email){
      setFormData(prev=> prev.schoolEmail ? prev : { ...prev, schoolEmail: authUser.email });
    }
  },[authUser]);

  // Prefill phone and personal email from candidate record for this lecturer
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try{
        // Only fetch if empty
        const needsPhone = !formData.phoneNumber;
        const needsEmail = !formData.personalEmail;
        if(!needsPhone && !needsEmail) return;
        const res = await axiosInstance.get('/lecturer-profile/me/candidate-contact');
        if(cancelled) return;
        const phone = res.data?.phone || '';
        const email = res.data?.personalEmail || '';
        setFormData(prev=> ({
          ...prev,
          phoneNumber: needsPhone && phone ? phone.replace(/^\+/,'') : prev.phoneNumber,
          personalEmail: needsEmail && email ? email : prev.personalEmail
        }));
        if(needsPhone && phone){
          const digitsOnly = String(phone || '').replace(/[^0-9+]/g, '');
          const normalized = digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
          setPhoneE164(normalized);
        }
      } catch(e){ /* ignore if not found */ }
    })();
    return ()=>{ cancelled = true; };
  },[formData.phoneNumber, formData.personalEmail]);

  // Prefill English Name from existing profile (if any) or auth user display/name/email slug; remain editable
  useEffect(()=>{
    if(formData.englishName) return; // don't overwrite if user started typing
    let cancelled = false;
    (async()=>{
      let apiTitle;
      try {
        const res = await axiosInstance.get('/lecturer-profile/me');
        const p = res.data || {};
        apiTitle = p.title;
        const name = p.full_name_english /* || p.full_name || p.user_display_name || p.display_name */;
        if(name && !cancelled){
          const composed = composeEnglishWithTitle(apiTitle, name);
          setFormData(prev=> prev.englishName ? prev : { ...prev, englishName: composed });
          return;
        }
  } catch (e) { void e; /* ignore: likely profile not created yet */ }
      if(!cancelled){
        const fallback = authUser?.display_name || authUser?.name || (authUser?.email ? authUser.email.split('@')[0].replace(/[._-]/g,' ') : '');
        if(fallback){
          const composed = composeEnglishWithTitle(apiTitle, fallback);
          setFormData(prev=> prev.englishName ? prev : { ...prev, englishName: composed });
        }
      }
    })();
    return ()=>{ cancelled = true; };
  },[authUser, formData.englishName]);

  const [files, setFiles] = useState({
    courseSyllabusFile: null,
    updatedCvFile: null,
    payrollFile: null
  });
  // Dynamic department & course catalogs
  const [departmentsCatalog, setDepartmentsCatalog] = useState([]);
  const [coursesCatalog, setCoursesCatalog] = useState([]);
  const [ _catalogLoading, setCatalogLoading ] = useState(false);

  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      setCatalogLoading(true);
      try {
        const [deptRes, courseRes] = await Promise.all([
          axiosInstance.get('/catalog/departments'),
          axiosInstance.get('/catalog/courses')
        ]);
        if(!cancelled){
          setDepartmentsCatalog(deptRes.data||[]);
          setCoursesCatalog(courseRes.data||[]);
        }
      } catch (e) {
          void e;
          toast.error('Failed to load catalogs');
        } finally { if(!cancelled) setCatalogLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  },[]);

  const availableCourseNames = useMemo(()=>{
    if(!formData.departments.length) return [];
    const deptIds = new Set(
      departmentsCatalog
        .filter(d=> formData.departments.includes(d.dept_name))
        .map(d=> d.id)
    );
    return coursesCatalog
      .filter(c=> deptIds.has(c.dept_id))
      .map(c=> c.course_name)
      .sort();
  },[formData.departments, departmentsCatalog, coursesCatalog]);
  const [researchFields, setResearchFields] = useState([]);
  const [newResearchField, setNewResearchField] = useState('');
  // Suggestions computed from API research fields filtered by typed text
  const researchSuggestions = useMemo(() => {
    const q = String(newResearchField || '').trim().toLowerCase();
    if (!q) return [];
    return researchFieldsAPI
      .map(r => r.name)
      .filter(name => name.toLowerCase().includes(q) && !researchFields.includes(name))
      .slice(0, 8);
  }, [newResearchField, researchFields, researchFieldsAPI]);
  // Autocomplete suggestions for university name
  const universitySuggestions = useMemo(() => {
    const q = String(formData.universityName || '').trim().toLowerCase();
    if (!q) return [];
    return universities
      .map(u => u.name)
      .filter(u => u.toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [formData.universityName, universities]);
  // If the input exactly matches a known university, hide suggestions
  const universityHasExactMatch = useMemo(() => {
    const q = String(formData.universityName || '').trim().toLowerCase();
    if (!q) return false;
    return universities.some(u => u.name.toLowerCase() === q);
  }, [formData.universityName, universities]);
  
  // Autocomplete suggestions for major name
  const majorSuggestions = useMemo(() => {
    const q = String(formData.majorName || '').trim().toLowerCase();
    if (!q) return [];
    return majors
      .map(m => m.name)
  .filter(m => m.toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [formData.majorName, majors]);
  
  // If the input exactly matches a known major, hide suggestions
  const majorHasExactMatch = useMemo(() => {
    const q = String(formData.majorName || '').trim().toLowerCase();
    if (!q) return false;
    return majors.some(m => m.name.toLowerCase() === q);
  }, [formData.majorName, majors]);
  
  // Prepare a simple list of country names from world-countries
  const countryList = useMemo(() => countries.map(c=> c.name.common).sort(), []);
  const countrySuggestions = useMemo(() => {
    const q = String(formData.country || '').trim().toLowerCase();
    if (!q) return [];
  return countryList.filter(c => c.toLowerCase().startsWith(q)).slice(0, 8);
  }, [formData.country, countryList]);
  // If the input exactly matches a known country, hide suggestions
  const countryHasExactMatch = useMemo(() => {
    const q = String(formData.country || '').trim().toLowerCase();
    if (!q) return false;
    return countryList.some(c => c.toLowerCase() === q);
  }, [formData.country, countryList]);
  const [showBankOptions, setShowBankOptions] = useState(false);
  const [showDegreeOptions, setShowDegreeOptions] = useState(false);
  const [showYearOptions, setShowYearOptions] = useState(false);
  const yearContainerRef = useRef(null);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let y = current; y >= 2000; y--) list.push(String(y));
    return list;
  }, []);
  useEffect(()=>{
    if(!showYearOptions) return;
    const handler = (e)=>{
      if(yearContainerRef.current && !yearContainerRef.current.contains(e.target)) setShowYearOptions(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return ()=>{
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  },[showYearOptions]);

  const updateForm = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
  const SHORT_BIO_MAX = 160;
  // Restrict Khmer name field to Khmer characters (Unicode U+1780 - U+17FF) and spaces.
  const khmerOnlyPattern = /[^\u1780-\u17FF\s]/g;
  const filterToKhmer = (s = '') => String(s).replace(khmerOnlyPattern, '');
  const handleKhmerNameChange = (e) => {
    const filtered = filterToKhmer(e.target.value);
    updateForm('khmerName', filtered);
  };
  const handleKhmerNamePaste = (e) => {
    // Prevent non-Khmer characters from being pasted; merge with existing value
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
    const filtered = filterToKhmer(pasted);
    e.preventDefault();
    // Append filtered paste to current value
    updateForm('khmerName', (formData.khmerName || '') + filtered);
  };
  // Account number: allow only digits, enforce max 16 digits and format with spaces every 4 digits
  const digitsOnlyPattern = /[^0-9]/g;
  const formatAccountNumber = (s = '') => {
    const digits = String(s).replace(digitsOnlyPattern, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };
  const handleAccountChange = (e) => {
    const formatted = formatAccountNumber(e.target.value);
    updateForm('accountName', formatted);
  };
  const handleAccountPaste = (e) => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
    const pastedDigits = String(pasted).replace(digitsOnlyPattern, '');
    e.preventDefault();
    const existingDigits = (formData.accountName || '').replace(digitsOnlyPattern, '');
    const combined = (existingDigits + pastedDigits).slice(0, 16);
    updateForm('accountName', combined.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
  };
  // Ensure account holder name is always uppercase on input and paste
  const englishOnlyPattern = /[^A-Za-z\s]/g; // allow only English letters and spaces
  const sanitizeEnglishUpper = (s = '') => String(s).toUpperCase().replace(englishOnlyPattern, '');
  const handleAccountHolderChange = (e) => {
    updateForm('accountHolderName', sanitizeEnglishUpper(e.target.value));
  };
  const handleAccountHolderPaste = (e) => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
    e.preventDefault();
    updateForm('accountHolderName', sanitizeEnglishUpper(pasted));
  };
  const handleFileUpload = (file, type) => {
    if (type === "syllabus") {
      setFiles(prev => ({ ...prev, courseSyllabusFile: file }));
    } else if (type === "cv") {
      setFiles(prev => ({ ...prev, updatedCvFile: file }));
    } else if (type === "payroll") {
      setFiles(prev => ({ ...prev, payrollFile: file }));
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addResearchFieldValue = async (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    if (researchFields.includes(v)) return;
    
    // Check if this field exists in the API data
    const existsInAPI = researchFieldsAPI.some(rf => rf.name.toLowerCase() === v.toLowerCase());
    
    if (!existsInAPI) {
      try {
        // Create new research field in the database
        await createResearchField(v);
        toast.success(`Added new research field: ${v}`);
      } catch (error) {
        console.error('Error creating research field:', error);
        // Still allow adding locally even if API call fails
        toast.error('Failed to save research field to database, but added locally');
      }
    }
    
    setResearchFields(prev => [...prev, v]);
    setNewResearchField('');
  };
  const addResearchField = () => addResearchFieldValue(newResearchField);

  const removeResearchField = (field) => {
    setResearchFields(researchFields.filter(f => f !== field));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      // Required-field validations per step (except Research Fields and Course Syllabus)
      // Step 1: Basic info
      if (!String(formData.englishName || '').trim()) {
        toast.error('Please enter your English name');
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.khmerName || '').trim()) {
        toast.error('Please enter your Khmer name');
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.accountHolderName || '').trim()) {
        toast.error('Please enter the account holder name');
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.bankName || '').trim()) {
        toast.error('Please select your bank');
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }
      if (!files.payrollFile) {
        toast.error('Please upload your payroll document');
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }

      // Step 2: Academic info
      if (!formData.departments || formData.departments.length === 0) {
        toast.error('Please select at least one department');
        setCurrentStep(2);
        setIsSubmitting(false);
        return;
      }
      if (!formData.courses || formData.courses.length === 0) {
        toast.error('Please select at least one course');
        setCurrentStep(2);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.shortBio || '').trim()) {
        toast.error('Please enter a short bio');
        setCurrentStep(2);
        setIsSubmitting(false);
        return;
      }
      if (!files.updatedCvFile) {
        toast.error('Please upload your updated CV');
        setCurrentStep(2);
        setIsSubmitting(false);
        return;
      }

      // Step 3: Education
      if (!String(formData.universityName || '').trim()) {
        toast.error('Please enter your university name');
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.country || '').trim()) {
        toast.error('Please enter your country');
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.majorName || '').trim()) {
        toast.error('Please enter your major');
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.graduationYear || '').trim()) {
        toast.error('Please select your graduation year');
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.latestDegree || '').trim()) {
        toast.error('Please select your latest degree');
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }

      // Step 4: Professional
      if (!String(formData.occupation || '').trim()) {
        toast.error('Please enter your current occupation');
        setCurrentStep(4);
        setIsSubmitting(false);
        return;
      }
      if (!String(formData.placeOfWork || '').trim()) {
        toast.error('Please enter your place of work');
        setCurrentStep(4);
        setIsSubmitting(false);
        return;
      }

      // Step 5: Contact - phone validated below; ensure school email is present
      if (!String(formData.schoolEmail || authUser?.email || '').trim()) {
        toast.error('Missing school email');
        setCurrentStep(5);
        setIsSubmitting(false);
        return;
      }
      // Validate phone number using libphonenumber-js
      if (phoneE164) {
        const parsed = parsePhoneNumberFromString(phoneE164);
        if (!parsed || !parsed.isValid()) {
          toast.error('Please enter a valid phone number');
          setIsSubmitting(false);
          return;
        }
      } else {
        toast.error('Please enter your phone number');
        setIsSubmitting(false);
        return;
      }
      // Validate account number: must have exactly 16 digits
      const acctDigits = (formData.accountName || '').replace(digitsOnlyPattern, '');
      if(acctDigits.length !== 16){
        toast.error('Account number must contain exactly 16 digits');
        setIsSubmitting(false);
        return;
      }
  // Validate personal email contains at least an '@'
      const personalEmail = String(formData.personalEmail || '').trim();
      if (!personalEmail || !personalEmail.includes('@')) {
        toast.error('Please enter a valid personal email (must include @)');
        setIsSubmitting(false);
        return;
      }
      const fd = new FormData();
      
      // Add form data with mapped field names
      fd.append('full_name_english', formData.englishName || '');
      fd.append('full_name_khmer', formData.khmerName || '');
      fd.append('bank_name', formData.bankName || '');
      fd.append('account_name', formData.accountHolderName || '');
      fd.append('account_number', formData.accountName || '');
      fd.append('short_bio', formData.shortBio || '');
      fd.append('university', formData.universityName || '');
      fd.append('country', formData.country || '');
      fd.append('major', formData.majorName || '');
      fd.append('degree_year', formData.graduationYear || '');
  // Map Associate to OTHER to satisfy backend ENUM
  fd.append('latest_degree', formData.latestDegree === 'ASSOCIATE' ? 'OTHER' : (formData.latestDegree || ''));
      fd.append('occupation', formData.occupation || '');
      fd.append('place', formData.placeOfWork || '');
      fd.append('phone_number', phoneE164 || formData.phoneNumber || '');
  fd.append('personal_email', formData.personalEmail || '');
  // Do not set position from lecturer onboarding; preserve admin-set position
      
      // Add research fields as comma-separated string
  fd.append('research_fields', researchFields.join(', '));
  // Persist selected departments & courses (temporary fields until model extension)
  if(formData.departments.length) fd.append('departments', formData.departments.join(', '));
      if(formData.courses.length){
        fd.append('courses', formData.courses.join(', ')); // backward compatibility
        // New: also send course_ids to ensure precise matching
        const selectedIds = coursesCatalog
          .filter(c=> formData.courses.includes(c.course_name))
          .map(c=> c.id);
        if(selectedIds.length) fd.append('course_ids', selectedIds.join(','));
      }
      
      // Add files
      if (files.updatedCvFile) fd.append('cv', files.updatedCvFile);
      if (files.courseSyllabusFile) fd.append('syllabus', files.courseSyllabusFile);
      if (files.payrollFile) fd.append('payroll', files.payrollFile);
      
      const res = await axiosInstance.post('/lecturers/onboarding', fd, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      const unmatched = res.data?.profile?.unmatched_courses || [];
      if(unmatched.length){
        toast.error(`Some courses not matched: ${unmatched.slice(0,3).join(', ')}`);
      } else {
        toast.success('Onboarding completed successfully!');
      }
      // Notify other open tabs (e.g., Admin Lecturer Management) to refresh immediately
      try {
        const payload = {
          type: 'onboarding_complete',
          userId: authUser?.id || res.data?.profile?.user_id || null,
          profileId: res.data?.profile?.id || null,
          timestamp: Date.now()
        };
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('lecturer-updates');
          bc.postMessage(payload);
          // Close to avoid lingering connections
          bc.close();
        }
        // Fallback for cross-tab communication
        localStorage.setItem('lecturer-onboarding-update', JSON.stringify(payload));
        // Clean up the flag shortly after to reduce clutter
        setTimeout(() => {
          try { localStorage.removeItem('lecturer-onboarding-update'); } catch {}
        }, 300);
      } catch {}
      navigate('/lecturer');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to submit onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">English Name *</label>
                <Input
                  value={formData.englishName}
                  onChange={(e) => updateForm('englishName', e.target.value)}
                  onBlur={() => updateForm('englishName', toTitleCase(formData.englishName))}
                  placeholder="Chan Dara"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Khmer Name *</label>
                <Input
                  value={formData.khmerName}
                  onChange={handleKhmerNameChange}
                  onPaste={handleKhmerNamePaste}
                  placeholder="ចាន់ ដារ៉ា"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Account Number *</label>
                <Input
                  value={formData.accountName}
                  onChange={handleAccountChange}
                  onPaste={handleAccountPaste}
                  placeholder="XXXX XXXX XXXX XXXX"
                  required
                  inputMode="numeric"
                  maxLength={19} /* 16 digits + 3 spaces */
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2 relative">
                <label className="block text-sm font-semibold text-gray-700">Bank Name *</label>
                <div className="relative">
                  <Input
                    value={formData.bankName}
                    readOnly
                    placeholder="Select a bank"
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                    onClick={() => setShowBankOptions(!showBankOptions)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBankOptions(!showBankOptions)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-transform duration-200"
                    style={{
                      transform: `translateY(-50%) ${showBankOptions ? 'rotate(180deg)' : 'rotate(0deg)'}`
                    }}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
                {showBankOptions && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1">
                    <div className="grid grid-cols-1 gap-2 p-3 border border-gray-200 rounded-md bg-white shadow-lg">
                      {[
                        "ACLEDA Bank"
                      ].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => {
                            updateForm('bankName', bank);
                            setShowBankOptions(false);
                          }}
                          className={`p-3 text-sm border rounded-md transition-all duration-200 text-left ${
                            formData.bankName === bank
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700">Account Holder Name *</label>
                <Input
                  value={formData.accountHolderName}
                  onChange={handleAccountHolderChange}
                  onPaste={handleAccountHolderPaste}
                  placeholder="Enter account holder name as it appears on bank records"
                  required
                  pattern="[A-Za-z\s]+"
                  title="Use English letters and spaces only"
                  inputMode="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700">Payroll Document (PDF or image) *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors duration-200">
                  {files.payrollFile ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileText className="h-6 w-6 text-green-600" />
                      <span className="text-sm text-gray-700 font-semibold">{files.payrollFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Upload payroll document</p>
                      <p className="text-xs text-gray-500 mt-1">PDF or image files only</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "payroll")}
                    className="hidden"
                    id="payroll-upload"
                  />
                  <Button 
                    variant="outline" 
                    className="mt-3 border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => document.getElementById('payroll-upload').click()}
                  >
                    Choose File
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {/* Departments first */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Departments *</label>
                  <span className="text-xs text-gray-500">Select one or more</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {departmentsCatalog.map(d => {
                    const active = formData.departments.includes(d.dept_name);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => {
                          setFormData(prev => {
                            const set = new Set(prev.departments);
                            if(set.has(d.dept_name)) set.delete(d.dept_name); else set.add(d.dept_name);
                            const newDepartments = Array.from(set);
                            const deptIds = new Set(
                              departmentsCatalog.filter(dep=> newDepartments.includes(dep.dept_name)).map(dep=> dep.id)
                            );
                            const available = coursesCatalog.filter(c=> deptIds.has(c.dept_id)).map(c=> c.course_name);
                            const newSelectedCourses = prev.courses.filter(c => available.includes(c));
                            return { ...prev, departments: newDepartments, courses: newSelectedCourses };
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full border text-xs md:text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${active ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'}`}
                      >
                        {d.dept_name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {formData.departments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-700">Courses *</label>
                    <span className="text-xs text-gray-500">Multiple selection</span>
                  </div>
                  <CourseMultiSelect
                    selected={formData.courses}
                    onChange={(next)=> setFormData(prev=>({...prev,courses:next}))}
                    options={availableCourseNames}
                  />
                </div>
              )}
              {/* Short Bio */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Short Bio *</label>
                <Textarea
                  value={formData.shortBio}
                  onChange={(e) => updateForm('shortBio', String(e.target.value || '').slice(0, SHORT_BIO_MAX))}
                  onPaste={(e) => {
                    const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
                    e.preventDefault();
                    const current = formData.shortBio || '';
                    const combined = (current + pasted).slice(0, SHORT_BIO_MAX);
                    updateForm('shortBio', combined);
                  }}
                  placeholder="Write a brief professional biography (2-3 sentences)"
                  rows={4}
                  maxLength={SHORT_BIO_MAX}
                  required
                />
                <p className="text-xs text-gray-500">{(formData.shortBio || '').length}/{SHORT_BIO_MAX} characters</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Research Fields </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={newResearchField}
                      onChange={(e) => setNewResearchField(e.target.value)}
                      placeholder="Enter research field"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addResearchField())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {researchSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-auto">
                        {researchSuggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addResearchFieldValue(s)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    onClick={addResearchField} 
                    variant="outline"
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {researchFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-600 border border-blue-200"
                    >
                      {field}
                      <button
                        type="button"
                        onClick={() => removeResearchField(field)}
                        className="ml-2 text-gray-600 hover:text-gray-800 w-4 h-4 rounded-full hover:bg-gray-200 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Course Syllabus</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors duration-200">
                  {files.courseSyllabusFile ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileText className="h-6 w-6 text-green-600" />
                      <span className="text-sm text-gray-700 font-semibold">{files.courseSyllabusFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Upload course syllabus</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, DOC, or DOCX files</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "syllabus")}
                    className="hidden"
                    id="syllabus-upload"
                  />
                  <Button 
                    variant="outline" 
                    className="mt-3 border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => document.getElementById('syllabus-upload').click()}
                  >
                    Choose File
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Updated CV *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors duration-200">
                  {files.updatedCvFile ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileText className="h-6 w-6 text-green-600" />
                      <span className="text-sm text-gray-700 font-semibold">{files.updatedCvFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Upload updated CV</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, DOC, or DOCX files</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "cv")}
                    className="hidden"
                    id="cv-upload"
                  />
                  <Button 
                    variant="outline" 
                    className="mt-3 border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => document.getElementById('cv-upload').click()}
                  >
                    Choose File
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">University Name *</label>
                <div className="relative">
                  <Input
                    value={formData.universityName}
                    onChange={(e) => updateForm('universityName', e.target.value)}
                    placeholder="Enter university name"
                    required
                    className="w-full"
                  />
                  {universitySuggestions.length > 0 && !universityHasExactMatch && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-auto">
                      {universitySuggestions.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => updateForm('universityName', u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Country *</label>
                <div className="relative">
                  <Input
                    value={formData.country}
                    onChange={(e) => updateForm('country', e.target.value)}
                    placeholder="Enter country"
                    required
                    className="w-full"
                  />
                  {countrySuggestions.length > 0 && !countryHasExactMatch && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-auto">
                      {countrySuggestions.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateForm('country', c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Major Name *</label>
                <div className="relative">
                  <Input
                    value={formData.majorName}
                    onChange={(e) => updateForm('majorName', e.target.value)}
                    placeholder="Enter your major"
                    required
                    className="w-full"
                  />
                  {majorSuggestions.length > 0 && !majorHasExactMatch && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-auto">
                      {majorSuggestions.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => updateForm('majorName', m)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 -mt-1" ref={yearContainerRef}>
                <Label htmlFor="graduationYear">Graduation Year *</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowYearOptions(v => !v)}
                    className="w-full text-left px-3 py-2 border border-gray-300 rounded-md bg-white flex items-center justify-between min-h-[42px]"
                  >
                    <span className={`text-sm ${formData.graduationYear? 'text-gray-800':'text-gray-400'}`}>
                      {formData.graduationYear || 'Select graduation year'}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transform transition-transform duration-200 ${showYearOptions ? 'rotate-180' : ''}`} />
                  </button>
                  {showYearOptions && (
                    <div className="absolute left-0 right-0 z-50 bottom-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                      {yearOptions.map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => { updateForm('graduationYear', y); setShowYearOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2 relative">
                <label className="block text-sm font-semibold text-gray-700">Latest Degree *</label>
                <div className="relative">
                  <Input
                    value={formData.latestDegree ? {
                      'BACHELOR': "Bachelor's Degree",
                      'MASTER': "Master's Degree", 
                      'PHD': "Ph.D.",
                      'POSTDOC': "Post-Doctoral",
                      'ASSOCIATE': "Associate Degree"
                    }[formData.latestDegree] : ''}
                    readOnly
                    placeholder="Select your highest degree"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                    onClick={() => setShowDegreeOptions(!showDegreeOptions)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDegreeOptions(!showDegreeOptions)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-transform duration-200"
                    style={{
                      transform: `translateY(-50%) ${showDegreeOptions ? 'rotate(180deg)' : 'rotate(0deg)'}`
                    }}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
                {showDegreeOptions && (
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-1">
                    <div className="grid grid-cols-2 gap-2 p-2 border border-gray-200 rounded-md bg-white shadow-lg">
                      {[
                        { value: 'ASSOCIATE', label: "Associate Degree" },
                        { value: 'BACHELOR', label: "Bachelor's Degree" },
                        { value: 'MASTER', label: "Master's Degree" },
                        { value: 'PHD', label: "Ph.D." },
                        { value: 'POSTDOC', label: "Post-Doctoral" }
                      ].map((degree) => (
                        <button
                          key={degree.value}
                          type="button"
                          onClick={() => {
                            updateForm('latestDegree', degree.value);
                            setShowDegreeOptions(false);
                          }}
                          className={`p-2.5 text-sm border rounded-md transition-all duration-200 text-left ${
                            formData.latestDegree === degree.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {degree.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Current Occupation *</label>
                <Input
                  value={formData.occupation}
                  onChange={(e) => updateForm('occupation', e.target.value)}
                  placeholder="Enter your current occupation"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Place of Work *</label>
                <Input
                  value={formData.placeOfWork}
                  onChange={(e) => updateForm('placeOfWork', e.target.value)}
                  placeholder="Enter your workplace"
                  required
                />
              </div>
            </div>
            {/* Payroll upload moved to Basic Information (case 1) */}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Phone Number *</label>
                <div>
                  <PhoneInput
                    country={'kh'}
                    value={formData.phoneNumber}
                    onChange={(value) => {
                      // react-phone-input-2 gives a numeric string without + by default when value is e.g. '855123...'
                      // Normalize to E.164 using plus sign and country calling code
                      const digitsOnly = String(value || '').replace(/[^0-9+]/g, '');
                      // If value starts without +, prepend +
                      const normalized = digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
                      updateForm('phoneNumber', value);
                      setPhoneE164(normalized);
                    }}
                    inputProps={{ name: 'phone', required: true }}
                    /* allow all countries - default country remains Cambodia via country={'kh'} */
                    enableSearch={true}
                    specialLabel={''}
                    containerClass="w-full min-h-[42px]"
                    inputClass="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    inputStyle={{ height: '42px', lineHeight: '1.25' }}
                    buttonClass="h-full"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Personal Email *</label>
                <Input
                  type="email"
                  value={formData.personalEmail}
                  onChange={(e) => updateForm('personalEmail', e.target.value)}
                  placeholder="Enter your personal email"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700">School Email Address</label>
                <Input
                  type="email"
                  value={formData.schoolEmail || authUser?.email || ''}
                  readOnly
                  placeholder="Institution email"
                  className="bg-gray-50 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">Filled from your login account and cannot be changed here.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 mb-2">
            Welcome to the University!
          </h1>
          <p className="text-blue-600">Please complete your profile to get started</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              Step {currentStep} of {steps.length}
            </span>
            <span className="text-sm text-blue-500">
              {Math.round(progress)}% complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-800 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between overflow-x-auto gap-4 sm:gap-0 -mx-3 px-3 sm:mx-0 sm:px-0">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center min-w-[140px] sm:min-w-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all duration-300 ${
                      currentStep === step.id 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : currentStep > step.id
                        ? 'bg-blue-200 border-blue-200 text-blue-700'
                        : 'border-blue-300 text-blue-400 bg-white'
                    }`}
                  >
                    {React.createElement(step.icon, { className: "h-4 w-4 sm:h-5 sm:w-5" })}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${
                      currentStep === step.id ? 'text-blue-600' : 'text-blue-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-blue-400 mt-1">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden sm:block flex-1 mx-4">
                    <div className={`h-0.5 transition-colors duration-300 ${
                      currentStep > step.id ? 'bg-blue-300' : 'bg-blue-200'
                    }`}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-blue-800 flex items-center mb-2">
              {React.createElement(steps[currentStep - 1].icon, { className: "h-5 w-5 mr-2" })}
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-blue-600 text-sm">{steps[currentStep - 1].description}</p>
          </div>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handlePrevious} 
            disabled={currentStep === 1}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />Previous
          </Button>
          {currentStep === steps.length ? (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2 bg-black text-white hover:bg-gray-800 rounded-md flex items-center disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center">Submitting...</span>
              ) : (
                <span className="flex items-center">Complete Onboarding</span>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-2 bg-black text-white hover:bg-gray-800 rounded-md flex items-center"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseMultiSelect({ options, selected, onChange }) {
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const containerRef = useRef(null);

  // Close on outside click (fixed)
  useEffect(()=>{
    if(!open) return;
    const handler = (e)=>{
      if(containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return ()=>{
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  },[open]);

  const toggle = (course)=>{
    const isSelected = selected.includes(course);
    if(isSelected){
      onChange(selected.filter(c=>c!==course));
      return;
    }
    onChange([...selected, course]);
  };

  const filtered = options.filter(o=> o.toLowerCase().includes(query.toLowerCase()));

  const buttonLabel = selected.length ? selected.join(', ') : 'Select courses';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={()=>setOpen(o=>!o)}
        className="w-full text-left px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px]"
        title={buttonLabel}
      >
        <span className="block truncate text-sm text-gray-700">{buttonLabel}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-2 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 border border-gray-200">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Search course..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {query && (
              <button type="button" onClick={()=>setQuery('')} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            )}
          </div>
          <div className="max-h-56 overflow-auto pr-1 space-y-1">
            {filtered.map(o=>{
              const active = selected.includes(o);
              return (
                <button
                  type="button"
                  key={o}
                  onClick={()=>toggle(o)}
                  className={`w-full text-left px-2 py-1 rounded text-xs md:text-sm transition-colors ${active? 'bg-blue-600 text-white':'hover:bg-gray-100 text-gray-700'}`}
                >
                  {o}
                  {active && <span className="ml-1">✓</span>}
                </button>
              );
            })}
            {filtered.length===0 && <div className="text-xs text-gray-500 px-2 py-2">No courses</div>}
          </div>
          <div className="flex justify-between items-center px-1 pt-1 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">{selected.length} selected</span>
            {selected.length>0 && (
              <button type="button" onClick={()=>onChange([])} className="text-[11px] text-red-600 hover:underline">Clear all</button>
            )}
          </div>
        </div>
      )}
      {selected.length>0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map(c=> (
            <span key={c} className="group inline-flex items-center bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200">
              {c}
              <button type="button" onClick={()=>toggle(c)} className="ml-1 text-blue-500 group-hover:text-blue-700 hover:scale-110 transition-transform">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
