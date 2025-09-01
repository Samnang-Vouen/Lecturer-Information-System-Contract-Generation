import React, { useEffect, useState, useRef } from 'react';
import dayjs from 'dayjs';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Plus, Star, MessageCircle, DollarSign, CheckCircle, XCircle, User, GraduationCap, Clock, AlertCircle, Edit2, Trash2, ChevronDown, Search, Eye } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import Select, { SelectItem } from '../../components/ui/Select.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.jsx';
import { axiosInstance } from '../../lib/axios.js';
import toast from 'react-hot-toast';

export default function Recruitment() {
  const [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activeStep, setActiveStep] = useState('add');
  // Grouped interview questions loaded from backend: { categoryName: [ {id, question_text} ] }
  const [categories, setCategories] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [searchCache, setSearchCache] = useState({});
  // Track per-candidate responses (ratings & notes) locally for real-time averages
  const [candidateResponses, setCandidateResponses] = useState({}); // { [candidateId]: { [questionId]: { rating:number, note:string } } }
  // UI state for accordion open categories
  const [openCategories, setOpenCategories] = useState([]); // array of category names
  // Add Question modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingCategory, setAddingCategory] = useState(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [questionDebounceTimer, setQuestionDebounceTimer] = useState(null);
  // Edit Question modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editSuggestions, setEditSuggestions] = useState([]);
  const [editSuggestLoading, setEditSuggestLoading] = useState(false);
  const [editQuestionDebounceTimer, setEditQuestionDebounceTimer] = useState(null);
  // Candidate search query
  const [candidateSearch, setCandidateSearch] = useState('');
  // Helpers to normalize & validate phone numbers to E.164 (+[countryCode][subscriberNumber], max 15 digits)
  const toE164 = (raw, dialCode) => {
    const digits = String(raw || '').replace(/\D/g, '');
    const dc = String(dialCode || '').replace(/\D/g, '');
    const withDial = digits.startsWith(dc) ? digits : `${dc}${digits}`;
    return withDial ? `+${withDial}` : '';
  };
  const isE164 = (val) => /^\+\d{8,15}$/.test(String(val || ''));

  const [newCandidate, setNewCandidate] = useState({ fullName: '', email: '', phone: '+855', positionAppliedFor: '', interviewDate: '' });
  const [finalDecision, setFinalDecision] = useState({ hourlyRate: '', rateReason: '', evaluator: '' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // View interview questions modal state
  const [showViewQuestionsModal, setShowViewQuestionsModal] = useState(false);
  const [viewQuestionsCandidate, setViewQuestionsCandidate] = useState(null);
  const [candidateInterviewData, setCandidateInterviewData] = useState(null);
  const [loadingInterviewData, setLoadingInterviewData] = useState(false);
  // Removed legacy calendar popover refs

  // Populate decision fields when selecting a finalized candidate
  useEffect(() => {
    if (selectedCandidate && ['accepted','rejected'].includes(selectedCandidate.status)) {
      setFinalDecision({
        hourlyRate: selectedCandidate.hourlyRate ? String(selectedCandidate.hourlyRate) : '',
        rateReason: selectedCandidate.rateReason || '',
        evaluator: selectedCandidate.evaluator || ''
      });
      setRejectionReason(selectedCandidate.rejectionReason || '');
    }
  }, [selectedCandidate]);

  const allFilled = ['fullName','email','phone','positionAppliedFor','interviewDate']
    .every((k) => String(newCandidate[k] || '').trim() !== '') && isE164(newCandidate.phone);

  // Load candidates & interview question categories from backend
  const fetchCandidates = async (nextPage = 1) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await axiosInstance.get('/candidates', { params: { page: nextPage, limit: 10 } });
      setCandidates(prev => nextPage === 1 ? data.data : [...prev, ...data.data.filter(n => !prev.some(p => p.id === n.id))]);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load candidates');
    } finally { setLoadingMore(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: iq } = await axiosInstance.get('/interview-questions');
        setCategories(iq.categories || {});
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load interview questions');
      } finally { setLoadingQuestions(false); }
    })();
    fetchCandidates(1);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || candidateSearch.trim()) return; // disable while searching
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !loadingMore) {
        fetchCandidates(page + 1);
      }
    }, { root: null, rootMargin: '0px', threshold: 1.0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page, candidateSearch]);

  const addNewCandidate = async () => {
    setSubmitAttempted(true);
    const requiredFields = ['fullName','email','phone','positionAppliedFor','interviewDate'];
    const missing = requiredFields.filter((k) => !String(newCandidate[k] || '').trim());
    if (missing.length) {
      toast.error('Please fill in all required fields');
      return;
    }
    const emailOk = /\S+@\S+\.\S+/.test(newCandidate.email);
    if (!emailOk) {
      toast.error('Please enter a valid email');
      return;
    }
    
    // Validate full name contains only English characters
    const englishNamePattern = /^[a-zA-Z\s\.\-\']+$/;
    if (!englishNamePattern.test(newCandidate.fullName.trim())) {
      toast.error('Full name must contain only English letters, spaces, periods, hyphens, and apostrophes');
      return;
    }
    
    // Normalize & validate phone number to E.164
    let phoneE164;
    try {
      phoneE164 = isE164(newCandidate.phone) ? newCandidate.phone : toE164(newCandidate.phone, '855');
      if (!isValidPhoneNumber(phoneE164)) {
        toast.error('Please enter a valid phone number in international format');
        return;
      }
      // Ensure state holds normalized value before submit
      if (newCandidate.phone !== phoneE164) {
        setNewCandidate((prev) => ({ ...prev, phone: phoneE164 }));
      }
    } catch (error) {
      toast.error('Please enter a valid phone number');
      return;
    }

    try {
  // Ensure payload uses normalized E.164 phone
  const payloadToSend = { ...newCandidate, phone: phoneE164 || newCandidate.phone };
  const { data } = await axiosInstance.post('/candidates', payloadToSend);
  setCandidates((prev) => [data, ...prev]);
  // keep pagination meta consistent (might have grown total) just allow hasMore true
  if (!hasMore) setHasMore(true);
  setNewCandidate({ fullName: '', email: '', phone: '+855', positionAppliedFor: '', interviewDate: '' });
      setSubmitAttempted(false);
      toast.success('Candidate added');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add candidate');
    }
  };

  const addInterviewQuestion = async (categoryName) => {
    const text = prompt('Enter new question');
    if (!text) return;
    try {
      const { data } = await axiosInstance.post('/interview-questions', { question_text: text, category: categoryName });
      setCategories(prev => ({ ...prev, [categoryName]: [...(prev[categoryName]||[]), { id: data.id, question_text: data.question_text }] }));
      toast.success('Question added');
    } catch (e) { toast.error('Failed to add question'); }
  };
  const editInterviewQuestion = (q) => {
    setEditingQuestion(q);
    setEditQuestionText(q.question_text);
    setEditSuggestions([]);
    setShowEditModal(true);
  };
  const saveRating = async (questionId, rating) => {
    if (!selectedCandidate) return toast.error('Select a candidate first');
    try {
      await axiosInstance.post('/interview-questions/candidate-questions', { candidate_id: selectedCandidate.id, question_id: questionId, rating });
      setCandidateResponses(prev => ({
        ...prev,
        [selectedCandidate.id]: {
          ...(prev[selectedCandidate.id] || {}),
          [questionId]: { ...(prev[selectedCandidate.id]?.[questionId] || {}), rating }
        }
      }));
      toast.success('Rating saved');
    }
    catch { toast.error('Failed to save rating'); }
  };
  const saveNote = async (questionId, noteVal) => {
    if (!selectedCandidate) return;
    if (!noteVal.trim()) return;
    try {
      await axiosInstance.post('/interview-questions/candidate-questions', { candidate_id: selectedCandidate.id, question_id: questionId, noted: noteVal });
      setCandidateResponses(prev => ({
        ...prev,
        [selectedCandidate.id]: {
          ...(prev[selectedCandidate.id] || {}),
          [questionId]: { ...(prev[selectedCandidate.id]?.[questionId] || {}), note: noteVal }
        }
      }));
      toast.success('Note saved');
    }
    catch { toast.error('Failed to save note'); }
  };
  const searchQuestions = async (val) => {
    if (!val) return [];
    if (searchCache[val]) return searchCache[val];
    try { const { data } = await axiosInstance.get('/interview-questions/search', { params: { query: val }}); setSearchCache(c => ({ ...c, [val]: data })); return data; }
    catch { return []; }
  };

  // Fetch candidate interview details
  const fetchCandidateInterviewDetails = async (candidateId) => {
    setLoadingInterviewData(true);
    try {
      const { data } = await axiosInstance.get(`/interview-questions/candidates/${candidateId}/interview-details`);
      setCandidateInterviewData(data);
    } catch (error) {
      console.error('Failed to fetch interview details:', error);
      toast.error('Failed to load interview details');
      setCandidateInterviewData(null);
    } finally {
      setLoadingInterviewData(false);
    }
  };

  // Compute current average for selected candidate from local responses
  const calculateAverageScore = () => {
    if (!selectedCandidate) return 0;
    const resp = candidateResponses[selectedCandidate.id] || {};
    const ratings = Object.values(resp).map(r => r.rating).filter(v => typeof v === 'number' && v > 0);
    if (!ratings.length) return 0;
    return ratings.reduce((a,b)=>a+b,0)/ratings.length;
  };
  const getCandidateAverage = (candidateId) => {
    const resp = candidateResponses[candidateId] || {};
    const ratings = Object.values(resp).map(r => r.rating).filter(Boolean);
    if (!ratings.length) return 0;
    return ratings.reduce((a,b)=>a+b,0)/ratings.length;
  };
  const getCategoryAverage = (candidateId, categoryName) => {
    if (!selectedCandidate) return 0;
    const resp = candidateResponses[candidateId] || {};
    const qIds = (categories[categoryName]||[]).map(q=>q.id);
    const ratings = qIds.map(id=>resp[id]?.rating).filter(Boolean);
    if (!ratings.length) return 0;
    return ratings.reduce((a,b)=>a+b,0)/ratings.length;
  };
  const ratingColorClass = (val) => {
    if (val >= 4) return 'bg-green-100 text-green-700 border-green-300';
    if (val >= 2.5) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (val > 0) return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };
  const valueColor = (val, base='text-gray-400') => {
    if (val >=4) return 'text-green-500';
    if (val >=2.5) return 'text-yellow-500';
    if (val>0) return 'text-red-500';
    return base;
  };
  const toggleCategory = (cat) => {
    setOpenCategories(prev => prev.includes(cat) ? prev.filter(c=>c!==cat) : [...prev, cat]);
  };
  const openAddQuestionModal = (cat) => {
    setAddingCategory(cat);
    setNewQuestionText('');
    setSuggestions([]);
    setShowAddModal(true);
  };
  const handleAddQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!addingCategory || !newQuestionText.trim()) return;
    try {
      const { data } = await axiosInstance.post('/interview-questions', { question_text: newQuestionText.trim(), category: addingCategory });
      setCategories(prev => ({ ...prev, [addingCategory]: [...(prev[addingCategory]||[]), { id: data.id, question_text: data.question_text }] }));
      toast.success('Question added');
      setShowAddModal(false);
    } catch { toast.error('Failed to add question'); }
  };
  const handleQuestionInputChange = (val) => {
    setNewQuestionText(val);
    if (questionDebounceTimer) clearTimeout(questionDebounceTimer);
    const t = setTimeout(async () => {
      if (!val.trim()) { setSuggestions([]); return; }
      setSuggestLoading(true);
      const res = await searchQuestions(val.trim());
      setSuggestions(res);
      setSuggestLoading(false);
    }, 400);
    setQuestionDebounceTimer(t);
  };
  const handleEditQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!editingQuestion || !editQuestionText.trim()) return;
    if (editQuestionText.trim() === editingQuestion.question_text) {
      setShowEditModal(false);
      return;
    }
    try {
      await axiosInstance.put(`/interview-questions/${editingQuestion.id}`, { question_text: editQuestionText.trim() });
      setCategories(prev => {
        const clone = { ...prev };
        Object.keys(clone).forEach(cat => { 
          clone[cat] = clone[cat].map(item => 
            item.id === editingQuestion.id ? { ...item, question_text: editQuestionText.trim() } : item
          ); 
        });
        return clone;
      });
      toast.success('Question updated');
      setShowEditModal(false);
    } catch { 
      toast.error('Failed to update question'); 
    }
  };
  const handleEditQuestionInputChange = (val) => {
    setEditQuestionText(val);
    if (editQuestionDebounceTimer) clearTimeout(editQuestionDebounceTimer);
    const t = setTimeout(async () => {
      if (!val.trim()) { setEditSuggestions([]); return; }
      setEditSuggestLoading(true);
      const res = await searchQuestions(val.trim());
      setEditSuggestions(res);
      setEditSuggestLoading(false);
    }, 400);
    setEditQuestionDebounceTimer(t);
  };
  const deleteInterviewQuestion = async (q) => {
    // Placeholder: backend delete endpoint may not exist yet
    // Optimistic local removal
    setCategories(prev => {
      const clone = { ...prev };
      Object.keys(clone).forEach(cat => { clone[cat] = clone[cat].filter(item => item.id !== q.id); });
      return clone;
    });
    toast.success('Question removed (local)');
  };

  const submitInterview = async () => {
    if (!selectedCandidate) return;
    const avg = calculateAverageScore();
    const status = avg > 2.5 ? 'discussion' : 'rejected';
    const payload = { interviewScore: avg, status, rejectionReason: status === 'rejected' ? (rejectionReason || 'Below minimum score') : null };
    try {
      const { data } = await axiosInstance.patch(`/candidates/${selectedCandidate.id}`, payload);
  setCandidates(prev => prev.map(c => c.id === data.id ? data : c));
      setSelectedCandidate(data);
      toast.success('Interview submitted');
      if (status === 'discussion') setActiveStep('discussion');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to submit interview');
    }
  };

  const acceptCandidate = async () => {
    if (!selectedCandidate) return;
    const payload = { status: 'accepted', hourlyRate: Number(finalDecision.hourlyRate), rateReason: finalDecision.rateReason, evaluator: finalDecision.evaluator };
    try {
      const { data } = await axiosInstance.patch(`/candidates/${selectedCandidate.id}`, payload);
  setCandidates((prev) => prev.map((c) => (c.id === data.id ? data : c)));
  setSelectedCandidate(data);
  setActiveStep('final');
      toast.success('Candidate accepted');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to accept candidate');
    }
  };

  const rejectCandidate = async () => {
    if (!selectedCandidate) return;
    const payload = { status: 'rejected', rejectionReason };
    try {
      const { data } = await axiosInstance.patch(`/candidates/${selectedCandidate.id}`, payload);
  setCandidates((prev) => prev.map((c) => (c.id === data.id ? data : c)));
  setSelectedCandidate(data);
  setActiveStep('final');
      toast.success('Candidate rejected');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to reject candidate');
    }
  };

  const handleDeleteCandidate = (e, candidate) => {
    e.stopPropagation();
    setCandidateToDelete(candidate);
    setShowDeleteModal(true);
  };

  const confirmDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/candidates/${candidateToDelete.id}`);
      setCandidates(prev => prev.filter(c => c.id !== candidateToDelete.id));
      if (selectedCandidate?.id === candidateToDelete.id) {
        setSelectedCandidate(null);
        setActiveStep('add');
      }
      toast.success('Candidate deleted');
      setShowDeleteModal(false);
      setCandidateToDelete(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const cancelDeleteCandidate = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setCandidateToDelete(null);
  };

  const handleViewQuestions = async (e, candidate) => {
    e.stopPropagation();
    setViewQuestionsCandidate(candidate);
    setShowViewQuestionsModal(true);
    await fetchCandidateInterviewDetails(candidate.id);
  };

  const closeViewQuestionsModal = () => {
    setShowViewQuestionsModal(false);
    setViewQuestionsCandidate(null);
    setCandidateInterviewData(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'discussion':
        return 'secondary';
      case 'interview':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'discussion':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'interview':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const StarRating = ({ rating, onRatingChange }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onRatingChange(star)} className={`p-1 rounded transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400`}>
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  );

  // Removed legacy calendar popover handlers & refs (were causing runtime errors after DateTimePicker migration)

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recruitment</h1>
            <p className="text-gray-600 mt-2">Manage lecturer recruitment process</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Recruitment Process Steps */}
          <div className="lg:col-span-2">
            <Tabs value={activeStep} onValueChange={setActiveStep}>
              <TabsList>
                <TabsTrigger value="add">Add Candidate</TabsTrigger>
                <TabsTrigger value="interview">Interview</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
                <TabsTrigger value="final">Final Decision</TabsTrigger>
              </TabsList>

              {/* Step 1: Add New Candidate */}
              <TabsContent value="add">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Step 1: Add New Lecturer Candidate
                    </CardTitle>
                    <CardDescription>Enter candidate information for the recruitment process</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <Input
                          required
                          value={newCandidate.fullName}
                          onChange={(e) => {
                            // Only allow English letters, spaces, periods, hyphens, and apostrophes
                            const englishOnly = e.target.value.replace(/[^a-zA-Z\s\.\-\']/g, '');
                            setNewCandidate({ ...newCandidate, fullName: englishOnly });
                          }}
                          onKeyPress={(e) => {
                            // Prevent non-English characters from being typed
                            const isValidChar = /[a-zA-Z\s\.\-\']/.test(e.key);
                            if (!isValidChar) {
                              e.preventDefault();
                            }
                          }}
                          className={`${submitAttempted && !newCandidate.fullName.trim() ? 'border-red-500 focus:ring-red-500' : ''}`}
                          placeholder="Enter full name (English only)"
                          title="Only English letters, spaces, periods, hyphens, and apostrophes are allowed"
                        />
                        {submitAttempted && !newCandidate.fullName.trim() && (
                          <p className="text-xs text-red-600">This field is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <Input
                          required
                          type="email"
                          value={newCandidate.email}
                          onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })}
                          className={`${submitAttempted && (!newCandidate.email.trim() || !/\S+@\S+\.\S+/.test(newCandidate.email)) ? 'border-red-500 focus:ring-red-500' : ''}`}
                          placeholder="candidate@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <PhoneInput
                          country={'kh'}
                          value={(newCandidate.phone || '').replace(/^\+/, '')}
                          onChange={(phone, country) => {
                            const e164 = toE164(phone, country?.dialCode);
                            setNewCandidate({ ...newCandidate, phone: e164 });
                          }}
                          enableSearch={true}
                          disableSearchIcon={false}
                          containerStyle={{
                            width: '100%'
                          }}
                          inputStyle={{
                            width: '100%',
                            height: '40px',
                            fontSize: '14px',
                            border: submitAttempted && !isE164(newCandidate.phone) ? '1px solid #ef4444' : '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            paddingLeft: '52px',
                            backgroundColor: '#ffffff'
                          }}
                          buttonStyle={{
                            border: submitAttempted && !isE164(newCandidate.phone) ? '1px solid #ef4444' : '1px solid #d1d5db',
                            borderRadius: '0.375rem 0 0 0.375rem',
                            backgroundColor: '#f9fafb',
                            borderRight: 'none'
                          }}
                          dropdownStyle={{
                            borderRadius: '0.375rem',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            zIndex: 1000
                          }}
                          placeholder="Enter phone number"
                        />
                        {submitAttempted && !isE164(newCandidate.phone) && (
                          <p className="text-xs text-red-600">Enter a valid phone in international format (e.g., +85512345678)</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Position Applied For</label>
                        <Select value={newCandidate.positionAppliedFor} onValueChange={(value) => setNewCandidate({ ...newCandidate, positionAppliedFor: value })} placeholder="Select position">
                          <SelectItem value="Lecturer">Lecturer</SelectItem>
                          <SelectItem value="Assistant Lecturer">Assistant Lecturer</SelectItem>
                          <SelectItem value="Senior Lecturer">Senior Lecturer</SelectItem>
                          <SelectItem value="Adjunct Lecturer">Adjunct Lecturer</SelectItem>
                          <SelectItem value="Visiting Lecturer">Visiting Lecturer</SelectItem>
                          <SelectItem value="Professor">Professor</SelectItem>
                        </Select>
                        {submitAttempted && !newCandidate.positionAppliedFor && (
                          <p className="text-xs text-red-600">This field is required</p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Interview Date & Time</label>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                          <DateTimePicker
                            label="Interview Date & Time"
                            value={newCandidate.interviewDate ? dayjs(newCandidate.interviewDate) : null}
                            onChange={(val)=> setNewCandidate(prev=>({...prev, interviewDate: val ? val.toISOString() : ''}))}
                            slotProps={{ textField: { size:'small', fullWidth:true, required:true, error: submitAttempted && !newCandidate.interviewDate } }}
                          />
                        </LocalizationProvider>
                        {submitAttempted && !newCandidate.interviewDate && (
                          <p className="text-xs text-red-600">This field is required</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={addNewCandidate} disabled={!allFilled} title={!allFilled ? 'Fill all fields to continue' : undefined}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Candidate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Step 2: Interview Evaluation */}
              <TabsContent value="interview">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      Step 2: Interview Evaluation
                    </CardTitle>
                    <CardDescription>{selectedCandidate ? `Evaluating: ${selectedCandidate.fullName}` : 'Select a candidate from the right list'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!selectedCandidate && (
                      <div className="text-center py-8">
                        <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Select a candidate from the list to start the interview evaluation</p>
                      </div>
                    )}
                    {selectedCandidate && (
                      <div className="space-y-4">
                        {/* Overall Score */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-white shadow-sm">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm font-medium text-gray-700">Overall Average</span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded border ${ratingColorClass(calculateAverageScore())}`}>
                              {calculateAverageScore().toFixed(2)} / 5
                            </span>
                            <span className="text-[11px] text-gray-500 hidden sm:inline">Real-time updates as you rate</span>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size='sm'
                              onClick={submitInterview}
                              disabled={calculateAverageScore() === 0}
                              title={calculateAverageScore() === 0 ? 'Add at least one rating to submit' : 'Submit interview & move to discussion'}
                              className={`ml-auto ${calculateAverageScore() === 0 
                                ? 'bg-gray-300 hover:bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              Submit Interview
                            </Button>
                          </div>
                        </div>

                        {loadingQuestions && <p className='text-sm text-gray-500'>Loading questions...</p>}
                        {!loadingQuestions && Object.keys(categories).length === 0 && (
                          <p className='text-xs text-gray-500'>No questions available.</p>
                        )}
                        <div className="space-y-3">
                          {Object.entries(categories).map(([catName, questions]) => {
                            const catAvg = getCategoryAverage(selectedCandidate.id, catName);
                            const open = openCategories.includes(catName);
                            return (
                              <div key={catName} className="border rounded-lg bg-white shadow-sm transition-colors">
                                <div className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 last:border-b-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(catName)}
                                    aria-expanded={open}
                                    aria-controls={`panel-${catName}`}
                                    className="flex-1 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-left">
                                      <span className="text-sm font-semibold text-gray-800">{catName}</span>
                                      <span className={`mt-1 sm:mt-0 text-[10px] font-medium px-2 py-0.5 rounded border ${ratingColorClass(catAvg)}`}>{catAvg.toFixed(2)} / 5</span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''} ml-2`} />
                                  </button>
                                  <div className="flex items-center gap-2 ml-2">
                                    <Button
                                      size='xs'
                                      variant='outline'
                                      onClick={() => openAddQuestionModal(catName)}
                                      className='flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium bg-white hover:bg-blue-50 border-blue-200 hover:border-blue-300 shadow-sm'
                                    >
                                      <Plus className='w-3 h-3 shrink-0' />
                                      <span className='leading-none'>Question</span>
                                    </Button>
                                  </div>
                                </div>
                                <div
                                  id={`panel-${catName}`}
                                  role="region"
                                  aria-labelledby={`header-${catName}`}
                                  className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[1600px] ease-in' : 'max-h-0 ease-out'}`}
                                >
                                  <div className="p-4 space-y-3">
                                    {questions.map(q => {
                                      const resp = candidateResponses[selectedCandidate.id]?.[q.id] || {};
                                      const currentRating = resp.rating || 0;
                                      return (
                                        <div key={q.id} className={`group border rounded-md p-3 shadow-sm hover:shadow-md transition relative ${currentRating ? 'border-blue-300' : 'border-gray-200'}`}>
                                          <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm flex-1 leading-relaxed">{q.question_text}</p>
                                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                              <button
                                                type='button'
                                                onClick={()=>editInterviewQuestion(q)}
                                                aria-label='Edit question'
                                                title='Edit question'
                                                className='w-8 h-8 flex items-center justify-center rounded-full border border-transparent text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition'
                                              >
                                                <Edit2 className='w-4 h-4'/>
                                              </button>
                                              <button
                                                type='button'
                                                onClick={()=>deleteInterviewQuestion(q)}
                                                aria-label='Remove question'
                                                title='Remove question'
                                                className='w-8 h-8 flex items-center justify-center rounded-full border border-transparent text-gray-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition'
                                              >
                                                <Trash2 className='w-4 h-4'/>
                                              </button>
                                            </div>
                                          </div>
                                          {/* Rating */}
                                          <div className='mt-3 flex flex-wrap items-center gap-3'>
                                            <div className='flex items-center gap-1' role='radiogroup' aria-label='Rating'>
                                              {[1,2,3,4,5].map(val => (
                                                <button
                                                  key={val}
                                                  type='button'
                                                  role='radio'
                                                  aria-checked={currentRating===val}
                                                  onClick={()=>saveRating(q.id, val)}
                                                  className={`w-8 h-8 flex items-center justify-center rounded-md border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${currentRating===val ? valueColor(val,'text-gray-600') + ' border-current bg-gray-50' : 'border-gray-200 hover:border-blue-300 hover:text-blue-500'}`}
                                                >
                                                  {val}
                                                </button>
                                              ))}
                                            </div>
                                            {currentRating>0 && (
                                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${ratingColorClass(currentRating)}`}>{currentRating}</span>
                                            )}
                                          </div>
                                          {/* Note */}
                                          <div className='mt-3'>
                                            <label className='sr-only'>Note</label>
                                            <Textarea
                                              rows={2}
                                              placeholder='Add note...'
                                              defaultValue={resp.note || ''}
                                              onBlur={(e)=>{ if(e.target.value.trim()) saveNote(q.id, e.target.value); }}
                                              className='text-xs resize-y'
                                            />
                                            <p className='text-[10px] text-gray-400 mt-1'>Blur field to save. Saved notes show toast.</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {questions.length===0 && <p className='text-[11px] text-gray-500'>No questions in this category.</p>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Step 3: External Discussion */}
              <TabsContent value="discussion">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-purple-600" />
                      Step 3: External Discussion
                    </CardTitle>
                    <CardDescription>
                      {selectedCandidate ? `Discussing: ${selectedCandidate.fullName}` : 'Candidate under review'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Candidate Under Review</h3>
                      <p className="text-gray-600 mb-6">The candidate is currently being discussed in Telegram or external discussion channels.<br />Please proceed to final decision when discussion is complete.</p>
                      <div className="flex justify-center gap-4">
                        <Button onClick={() => setActiveStep('final')} className="bg-purple-600 hover:bg-purple-700">Proceed to Final Decision</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Step 4: Final Decision */}
              <TabsContent value="final">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      Step 4: Hourly Rate & Final Acceptance
                    </CardTitle>
                    <CardDescription>{selectedCandidate ? `Final decision for: ${selectedCandidate.fullName}` : 'Make final decision'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {selectedCandidate ? (
                      <>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Candidate Summary</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-600">Name:</span><span className="ml-2 font-medium">{selectedCandidate.fullName}</span></div>
                            <div><span className="text-gray-600">Position:</span><span className="ml-2 font-medium">{selectedCandidate.positionAppliedFor}</span></div>
                            <div><span className="text-gray-600">Interview Score:</span><span className="ml-2 font-medium">{selectedCandidate.interviewScore != null ? Number(selectedCandidate.interviewScore).toFixed(1) : '-'} /5.0</span></div>
                            <div><span className="text-gray-600">Status:</span><Badge variant={getStatusColor(selectedCandidate.status)} className="ml-2">{getStatusIcon(selectedCandidate.status)}<span className="ml-1">{selectedCandidate.status}</span></Badge></div>
                          </div>
                        </div>
                        {(() => {
                          const finalized = ['accepted','rejected'].includes(selectedCandidate.status);
                          if (finalized) {
                            return (
                              <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Hourly Rate ($)</label>
                                    <Input disabled value={selectedCandidate.hourlyRate ?? ''} className="bg-gray-100 text-gray-700" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Evaluator</label>
                                    <Input disabled value={selectedCandidate.evaluator || ''} className="bg-gray-100 text-gray-700" />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason for Rate</label>
                                  <Textarea disabled value={selectedCandidate.rateReason || ''} rows={3} className="bg-gray-100 text-gray-700" />
                                </div>
                                {selectedCandidate.status === 'rejected' && (
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason for Rejection</label>
                                    <Textarea disabled value={selectedCandidate.rejectionReason || ''} rows={3} className="bg-gray-100 text-gray-700" />
                                  </div>
                                )}
                                <p className="text-[11px] text-gray-500">Finalized decision. Fields are read-only.</p>
                              </div>
                            );
                          }
                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
                                  <Input type="number" value={finalDecision.hourlyRate} onChange={(e) => setFinalDecision({ ...finalDecision, hourlyRate: e.target.value })} placeholder="85" />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-sm font-medium text-gray-700">Name of Evaluator</label>
                                  <Input value={finalDecision.evaluator} onChange={(e) => setFinalDecision({ ...finalDecision, evaluator: e.target.value })} placeholder="Dr. John Smith" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Reason for Rate</label>
                                <Textarea
                                  value={finalDecision.rateReason}
                                  onChange={(e) => setFinalDecision({ ...finalDecision, rateReason: (e.target.value || '').slice(0,160) })}
                                  placeholder="Explain the reasoning for the hourly rate..."
                                  rows={3}
                                  maxLength={160}
                                />
                                <div className="mt-1 text-[11px] text-gray-500 text-right">{(finalDecision.rateReason || '').length}/160</div>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Rejection Reason (if rejecting)</label>
                                <Textarea
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason((e.target.value || '').slice(0,160))}
                                  placeholder="Enter reason for rejection..."
                                  rows={3}
                                  maxLength={160}
                                />
                                <div className="mt-1 text-[11px] text-gray-500 text-right">{(rejectionReason || '').length}/160</div>
                              </div>
                              <div className="flex justify-end gap-4">
                                <Button onClick={rejectCandidate} variant="outline" className="text-red-600 border-red-600 hover:bg-red-50"><XCircle className="w-4 h-4 mr-2" />Reject Candidate</Button>
                                <Button onClick={acceptCandidate} className="bg-green-600 hover:bg-green-700"><CheckCircle className="w-4 h-4 mr-2" />Accept Candidate</Button>
                              </div>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-8"><DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">Select a candidate to make final decision</p></div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Candidates List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Candidates</CardTitle>
                <CardDescription>All recruitment candidates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={candidateSearch}
                    onChange={(e)=>setCandidateSearch(e.target.value)}
                    placeholder="Search candidates..."
                    className="pl-8 text-sm"
                    aria-label="Search candidates by name"
                  />
                </div>
                <div className="space-y-3">
                  {candidates
                    .filter(c => !candidateSearch.trim() || c.fullName.toLowerCase().includes(candidateSearch.trim().toLowerCase()))
                    .map(candidate => {
                      const handleClick = () => {
                        setSelectedCandidate(candidate);
                        if (candidate.status === 'pending' || candidate.status === 'interview') setActiveStep('interview');
                        else if (candidate.status === 'discussion') setActiveStep('discussion');
                        else setActiveStep('final');
                      };
                      return (
                        <div
                          key={candidate.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedCandidate?.id === candidate.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={handleClick}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 pr-2">
                              <h4 className="font-medium text-gray-900 text-sm flex items-start justify-between">
                                <span>{candidate.fullName}</span>
                              </h4>
                              <p className="text-xs text-gray-600">{candidate.positionAppliedFor}</p>
                              {candidate.interviewDate && (
                                <p className="text-[10px] text-gray-500 mt-0.5">{dayjs(candidate.interviewDate).format('MMM D, HH:mm')}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={getStatusColor(candidate.status)} className="text-xs">{getStatusIcon(candidate.status)}<span className="ml-1">{candidate.status}</span></Badge>
                              </div>
                              {candidate.interviewScore && (
                                <p className="text-xs text-gray-500 mt-1">Score: {Number(candidate.interviewScore).toFixed(1)}/5.0</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {(candidate.status === 'interview' || candidate.status === 'discussion' || candidate.status === 'accepted' || candidate.status === 'rejected') && (
                                <button
                                  type="button"
                                  onClick={(e)=>handleViewQuestions(e, candidate)}
                                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition"
                                  title="View interview questions and responses"
                                  aria-label="View interview questions"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e)=>handleDeleteCandidate(e, candidate)}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                                title="Delete candidate"
                                aria-label="Delete candidate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {candidates.filter(c => !candidateSearch.trim() || c.fullName.toLowerCase().includes(candidateSearch.trim().toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-500">No candidates found.</p>
                  )}
                  {/* Infinite scroll sentinel (hidden while searching) */}
                  {!candidateSearch.trim() && hasMore && (
                    <div ref={loadMoreRef} className="h-6 flex items-center justify-center text-[11px] text-gray-400">
                      {loadingMore ? 'Loading...' : ''}
                    </div>
                  )}
                  {!candidateSearch.trim() && !hasMore && candidates.length > 0 && (
                    <p className="text-[11px] text-center text-gray-400">End of list</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {showAddModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 animate-fade" onClick={()=>setShowAddModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <h2 className="text-lg font-semibold">Add Question to {addingCategory}</h2>
            <form onSubmit={handleAddQuestionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Question Text</label>
                <Textarea
                  rows={3}
                  value={newQuestionText}
                  onChange={(e)=>handleQuestionInputChange(e.target.value)}
                  placeholder="Type question... (suggestions appear below)"
                  className="text-sm"
                  aria-describedby="question-suggestions"
                  autoFocus
                />
              </div>
              <div id="question-suggestions" className="space-y-1 max-h-40 overflow-auto border rounded-md p-2 bg-gray-50">
                {suggestLoading && <p className="text-[11px] text-gray-500">Searching...</p>}
                {!suggestLoading && suggestions.length === 0 && newQuestionText.trim() && (
                  <p className="text-[11px] text-green-600">No similar existing question. Looks unique.</p>
                )}
                {suggestions.map(s => (
                  <button
                    type="button"
                    key={s.id || s.question_text}
                    onClick={()=>setNewQuestionText(s.question_text)}
                    className="w-full text-left text-[12px] px-2 py-1 rounded hover:bg-white border border-transparent hover:border-blue-200"
                  >
                    {s.question_text || s}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={()=>setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={!newQuestionText.trim()}>Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEditModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 animate-fade" onClick={()=>setShowEditModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <h2 className="text-lg font-semibold">Edit Question</h2>
            <form onSubmit={handleEditQuestionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Question Text</label>
                <Textarea
                  rows={3}
                  value={editQuestionText}
                  onChange={(e)=>handleEditQuestionInputChange(e.target.value)}
                  placeholder="Type question... (suggestions appear below)"
                  className="text-sm"
                  aria-describedby="edit-question-suggestions"
                  autoFocus
                />
              </div>
              <div id="edit-question-suggestions" className="space-y-1 max-h-40 overflow-auto border rounded-md p-2 bg-gray-50">
                {editSuggestLoading && <p className="text-[11px] text-gray-500">Searching...</p>}
                {!editSuggestLoading && editSuggestions.length === 0 && editQuestionText.trim() && (
                  <p className="text-[11px] text-green-600">No similar existing question. Looks unique.</p>
                )}
                {editSuggestions.map(s => (
                  <button
                    type="button"
                    key={s.id || s.question_text}
                    onClick={()=>setEditQuestionText(s.question_text)}
                    className="w-full text-left text-[12px] px-2 py-1 rounded hover:bg-white border border-transparent hover:border-blue-200"
                  >
                    {s.question_text || s}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={()=>setShowEditModal(false)}>Cancel</Button>
                <Button type="submit" disabled={!editQuestionText.trim()}>Update</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showViewQuestionsModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeViewQuestionsModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Interview Questions & Responses
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {viewQuestionsCandidate?.fullName} - {viewQuestionsCandidate?.positionAppliedFor}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingInterviewData && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-gray-500">Loading interview data...</div>
                </div>
              )}
              {!loadingInterviewData && candidateInterviewData && (
                <div className="space-y-6">
                  {candidateInterviewData.responses.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No interview responses found for this candidate.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="font-medium text-blue-900 mb-2">Interview Summary</h3>
                        
                        {/* Candidate Information */}
                        <div className="bg-white border border-blue-100 rounded-md p-3 mb-4">
                          <h4 className="text-sm font-medium text-blue-800 mb-2">Candidate Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-blue-700">Full Name:</span>
                              <span className="ml-2 font-medium">{viewQuestionsCandidate?.fullName}</span>
                            </div>
                            <div>
                              <span className="text-blue-700">Email:</span>
                              <span className="ml-2 font-medium">{viewQuestionsCandidate?.email}</span>
                            </div>
                            <div>
                              <span className="text-blue-700">Phone Number:</span>
                              <span className="ml-2 font-medium">{viewQuestionsCandidate?.phone}</span>
                            </div>
                            <div>
                              <span className="text-blue-700">Position Applied For:</span>
                              <span className="ml-2 font-medium">{viewQuestionsCandidate?.positionAppliedFor}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interview Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-blue-700">Total Questions:</span>
                            <span className="ml-2 font-medium">{candidateInterviewData.responses.length}</span>
                          </div>
                          <div>
                            <span className="text-blue-700">Questions with Ratings:</span>
                            <span className="ml-2 font-medium">
                              {candidateInterviewData.responses.filter(r => r.rating).length}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-700">Average Rating:</span>
                            <span className="ml-2 font-medium">
                              {candidateInterviewData.responses.filter(r => r.rating).length > 0
                                ? (candidateInterviewData.responses
                                    .filter(r => r.rating)
                                    .reduce((sum, r) => sum + r.rating, 0) /
                                  candidateInterviewData.responses.filter(r => r.rating).length).toFixed(1)
                                : 'N/A'} / 5.0
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Group responses by category */}
                        {Object.entries(
                          candidateInterviewData.responses.reduce((acc, response) => {
                            const category = response.category || 'Uncategorized';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(response);
                            return acc;
                          }, {})
                        ).map(([category, responses]) => (
                          <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                              <h4 className="font-medium text-gray-900">{category}</h4>
                              <p className="text-xs text-gray-600 mt-1">
                                {responses.length} question{responses.length !== 1 ? 's' : ''} • 
                                Average: {responses.filter(r => r.rating).length > 0
                                  ? (responses.filter(r => r.rating).reduce((sum, r) => sum + r.rating, 0) / 
                                     responses.filter(r => r.rating).length).toFixed(1)
                                  : 'N/A'}/5.0
                              </p>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {responses.map((response, index) => (
                                <div key={response.id || index} className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <h5 className="font-medium text-gray-900 text-sm flex-1 pr-4">
                                      {response.question_text}
                                    </h5>
                                    {response.rating && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <div className="flex">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                              key={star}
                                              className={`w-4 h-4 ${
                                                star <= response.rating
                                                  ? 'text-yellow-400 fill-current'
                                                  : 'text-gray-300'
                                              }`}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-xs text-gray-600 ml-1">
                                          {response.rating}/5
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {response.noted && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mt-2">
                                      <h6 className="text-xs font-medium text-gray-700 mb-1">Notes:</h6>
                                      <p className="text-sm text-gray-600 leading-relaxed">
                                        {response.noted}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-end mt-3">
                                    {response.created_at && (
                                      <div className="text-xs text-gray-500">
                                        {dayjs(response.created_at).format('MMM D, YYYY HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={closeViewQuestionsModal}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDeleteCandidate} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Delete Candidate</h2>
            <p className="text-sm text-gray-600">Are you sure you want to permanently delete <span className="font-medium">{candidateToDelete?.fullName}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={cancelDeleteCandidate} disabled={deleting}>Cancel</Button>
              <Button type="button" onClick={confirmDeleteCandidate} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
