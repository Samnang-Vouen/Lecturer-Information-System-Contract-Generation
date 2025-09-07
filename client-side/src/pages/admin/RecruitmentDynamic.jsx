import React, { useEffect, useState, useRef } from 'react';
import { Plus, Star, MessageCircle, DollarSign, CheckCircle, XCircle, User, GraduationCap, Clock, AlertCircle, Edit2, Trash2, ChevronDown, Search, Eye, Calendar, Phone, Mail, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useCandidates } from '../../hooks/useCandidates';
import { useInterviewQuestions } from '../../hooks/useInterviewQuestions';
import { useCandidateResponses } from '../../hooks/useCandidateResponses';
import toast from 'react-hot-toast';

export default function Recruitment() {
  // Custom hooks for API integration
  const {
    candidates,
    loading: candidatesLoading,
    error: candidatesError,
    pagination,
    createCandidate,
    updateCandidate,
    deleteCandidate,
    loadMore,
    refresh: refreshCandidates,
    setError: setCandidatesError
  } = useCandidates();

  const {
    categories,
    loading: questionsLoading,
    error: questionsError,
    refresh: refreshQuestions,
    setError: setQuestionsError
  } = useInterviewQuestions();

  const {
    candidateResponses,
    loading: responsesLoading,
    error: responsesError,
    fetchCandidateInterviewDetails,
    saveResponse,
    updateResponse,
    calculateAverageScore,
    setError: setResponsesError
  } = useCandidateResponses();

  // Component state
  const loadMoreRef = useRef(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activeStep, setActiveStep] = useState('add');
  const [openCategories, setOpenCategories] = useState(['Teaching Skills']);
  const [candidateSearch, setCandidateSearch] = useState('');
  
  // Loading states for different operations
  const [submitting, setSubmitting] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);

  // Form states
  const [newCandidate, setNewCandidate] = useState({ 
    fullName: '', 
    email: '', 
    phone: '+855', 
    positionAppliedFor: '', 
    interviewDate: '' 
  });
  const [finalDecision, setFinalDecision] = useState({ 
    hourlyRate: '', 
    rateReason: '', 
    evaluator: '' 
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showViewQuestionsModal, setShowViewQuestionsModal] = useState(false);
  const [viewQuestionsCandidate, setViewQuestionsCandidate] = useState(null);

  // Error handling
  useEffect(() => {
    if (candidatesError) {
      toast.error(candidatesError);
      setCandidatesError(null);
    }
  }, [candidatesError, setCandidatesError]);

  useEffect(() => {
    if (questionsError) {
      toast.error(questionsError);
      setQuestionsError(null);
    }
  }, [questionsError, setQuestionsError]);

  useEffect(() => {
    if (responsesError) {
      toast.error(responsesError);
      setResponsesError(null);
    }
  }, [responsesError, setResponsesError]);

  // Infinite scroll for candidates
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasMore && !candidatesLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [pagination.hasMore, candidatesLoading, loadMore]);

  // Load interview details when a candidate is selected
  useEffect(() => {
    if (selectedCandidate && activeStep === 'interview') {
      fetchCandidateInterviewDetails(selectedCandidate.id);
    }
  }, [selectedCandidate, activeStep, fetchCandidateInterviewDetails]);

  // Utility functions
  const isE164 = (val) => /^\+\d{8,15}$/.test(String(val || ''));
  const allFilled = ['fullName','email','phone','positionAppliedFor','interviewDate']
    .every((k) => String(newCandidate[k] || '').trim() !== '') && isE164(newCandidate.phone);

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'discussion': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'interview': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'rejected': return <XCircle className="w-3.5 h-3.5" />;
      case 'discussion': return <MessageCircle className="w-3.5 h-3.5" />;
      case 'interview': return <Clock className="w-3.5 h-3.5" />;
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      default: return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const ratingColorClass = (val) => {
    if (val >= 4) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (val >= 2.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (val > 0) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getCurrentAverageScore = () => {
    if (!selectedCandidate) return 0;
    return calculateAverageScore(selectedCandidate.id);
  };

  const toggleCategory = (cat) => {
    setOpenCategories(prev => prev.includes(cat) ? prev.filter(c=>c!==cat) : [...prev, cat]);
  };

  const saveRating = async (questionId, rating) => {
    if (!selectedCandidate) return;
    
    try {
      setSavingResponse(true);
      
      // Update local state immediately for better UX
      updateResponse(selectedCandidate.id, questionId, { rating });
      
      // Save to backend
      await saveResponse(selectedCandidate.id, questionId, { rating });
      
      toast.success('Rating saved');
    } catch (error) {
      toast.error('Failed to save rating');
    } finally {
      setSavingResponse(false);
    }
  };

  const saveNote = async (questionId, noted) => {
    if (!selectedCandidate) return;
    
    try {
      // Update local state immediately
      updateResponse(selectedCandidate.id, questionId, { noted });
      
      // Save to backend (debounced)
      await saveResponse(selectedCandidate.id, questionId, { noted });
    } catch (error) {
      toast.error('Failed to save note');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateCandidate = async () => {
    if (!allFilled) {
      setSubmitAttempted(true);
      return;
    }

    try {
      setSubmitting(true);
      
      await createCandidate({
        ...newCandidate,
        interviewDate: newCandidate.interviewDate ? new Date(newCandidate.interviewDate).toISOString() : null
      });
      
      setNewCandidate({ fullName: '', email: '', phone: '+855', positionAppliedFor: '', interviewDate: '' });
      setSubmitAttempted(false);
      toast.success('Candidate added successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCandidateStatus = async (candidateId, status, additionalData = {}) => {
    try {
      setSubmitting(true);
      
      await updateCandidate(candidateId, {
        status,
        ...additionalData
      });
      
      // Update selected candidate if it's the one being updated
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status, ...additionalData }));
      }
      
      toast.success(`Candidate ${status === 'accepted' ? 'accepted' : 'rejected'} successfully`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!candidateToDelete) return;

    try {
      setDeleting(true);
      
      await deleteCandidate(candidateToDelete.id);
      
      // Clear selected candidate if it was deleted
      if (selectedCandidate?.id === candidateToDelete.id) {
        setSelectedCandidate(null);
      }
      
      setShowDeleteModal(false);
      setCandidateToDelete(null);
      toast.success('Candidate deleted successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const submitInterview = async () => {
    if (!selectedCandidate) return;
    
    try {
      setSubmitting(true);
      
      const averageScore = getCurrentAverageScore();
      
      await updateCandidate(selectedCandidate.id, {
        status: 'discussion',
        interviewScore: averageScore
      });
      
      setSelectedCandidate(prev => ({ 
        ...prev, 
        status: 'discussion', 
        interviewScore: averageScore 
      }));
      
      setActiveStep('discussion');
      toast.success('Interview submitted successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ rating, onRatingChange, disabled = false }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button 
          key={star} 
          type="button" 
          onClick={() => !disabled && onRatingChange(star)} 
          disabled={disabled || savingResponse}
          className={`p-1 rounded-md transition-all duration-200 ${
            disabled 
              ? 'cursor-not-allowed opacity-50' 
              : star <= rating 
                ? 'text-amber-400 hover:text-amber-500' 
                : 'text-gray-300 hover:text-amber-300'
          }`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  );

  const filteredCandidates = candidates.filter(candidate => 
    !candidateSearch || 
    candidate.fullName.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    candidate.email.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    candidate.positionAppliedFor.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  const LoadingSpinner = ({ size = 'w-5 h-5' }) => (
    <Loader2 className={`${size} animate-spin`} />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header */}
      <div className="border-b border-white/60 bg-white/70 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Recruitment Management
              </h1>
              <p className="text-slate-600 mt-2 font-medium">Streamlined lecturer hiring process</p>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <button
                onClick={refreshCandidates}
                disabled={candidatesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white/80 border border-slate-200 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                {candidatesLoading ? <LoadingSpinner /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </button>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">{candidates.length}</div>
                <div className="text-sm text-slate-600">Total Candidates</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Main Content */}
          <div className="xl:col-span-3">
            {/* Step Navigation */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 mb-8">
              <div className="p-6">
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'add', label: 'Add Candidate', icon: User, color: 'blue' },
                    { key: 'interview', label: 'Interview', icon: GraduationCap, color: 'indigo' },
                    { key: 'discussion', label: 'Discussion', icon: MessageCircle, color: 'purple' },
                    { key: 'final', label: 'Final Decision', icon: DollarSign, color: 'emerald' }
                  ].map((step) => {
                    const Icon = step.icon;
                    const isActive = activeStep === step.key;
                    return (
                      <button
                        key={step.key}
                        onClick={() => setActiveStep(step.key)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                          isActive 
                            ? `bg-gradient-to-r from-${step.color}-500 to-${step.color}-600 text-white shadow-lg shadow-${step.color}-500/30 scale-105` 
                            : 'bg-white/80 text-slate-700 hover:bg-white hover:shadow-md border border-slate-200/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{step.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step Content */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60">
              
              {/* Add Candidate */}
              {activeStep === 'add' && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Add New Candidate</h2>
                      <p className="text-slate-600 mt-1">Enter candidate information to begin the recruitment process</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Full Name */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <User className="w-4 h-4" />
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={newCandidate.fullName}
                          onChange={(e) => setNewCandidate(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="Dr. John Smith"
                        />
                        {submitAttempted && !newCandidate.fullName && (
                          <p className="text-red-500 text-sm">Full name is required</p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Mail className="w-4 h-4" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={newCandidate.email}
                          onChange={(e) => setNewCandidate(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="john.smith@email.com"
                        />
                        {submitAttempted && !newCandidate.email && (
                          <p className="text-red-500 text-sm">Email is required</p>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Phone className="w-4 h-4" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={newCandidate.phone}
                          onChange={(e) => setNewCandidate(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="+855 12 345 678"
                        />
                        {submitAttempted && !isE164(newCandidate.phone) && (
                          <p className="text-red-500 text-sm">Valid phone number is required</p>
                        )}
                      </div>

                      {/* Position */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <GraduationCap className="w-4 h-4" />
                          Position Applied For
                        </label>
                        <select
                          value={newCandidate.positionAppliedFor}
                          onChange={(e) => setNewCandidate(prev => ({ ...prev, positionAppliedFor: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        >
                          <option value="">Select Position</option>
                          <option value="Lecturer">Lecturer</option>
                          <option value="Assistant Lecturer">Assistant Lecturer</option>
                          <option value="Senior Lecturer">Senior Lecturer</option>
                          <option value="Professor">Professor</option>
                        </select>
                        {submitAttempted && !newCandidate.positionAppliedFor && (
                          <p className="text-red-500 text-sm">Position is required</p>
                        )}
                      </div>

                      {/* Interview Date */}
                      <div className="space-y-3 lg:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Calendar className="w-4 h-4" />
                          Interview Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={newCandidate.interviewDate}
                          onChange={(e) => setNewCandidate(prev => ({ ...prev, interviewDate: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        />
                        {submitAttempted && !newCandidate.interviewDate && (
                          <p className="text-red-500 text-sm">Interview date is required</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-slate-200/50">
                      <button
                        onClick={handleCreateCandidate}
                        disabled={submitting}
                        className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? <LoadingSpinner /> : <Plus className="w-5 h-5" />}
                        {submitting ? 'Adding...' : 'Add Candidate'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Interview Evaluation */}
              {activeStep === 'interview' && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Interview Evaluation</h2>
                      <p className="text-slate-600 mt-1">
                        {selectedCandidate ? `Evaluating: ${selectedCandidate.fullName}` : 'Select a candidate to begin evaluation'}
                      </p>
                    </div>
                    {questionsLoading && (
                      <div className="ml-auto">
                        <LoadingSpinner />
                      </div>
                    )}
                  </div>

                  {!selectedCandidate ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <GraduationCap className="w-10 h-10 text-slate-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-3">Select a Candidate</h3>
                      <p className="text-slate-600 max-w-md mx-auto">Choose a candidate from the sidebar to start the interview evaluation process.</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Score Summary */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Overall Score</h3>
                            <div className="flex items-center gap-4">
                              <span className={`px-4 py-2 rounded-xl border font-bold ${ratingColorClass(getCurrentAverageScore())}`}>
                                {getCurrentAverageScore().toFixed(1)} / 5.0
                              </span>
                              <span className="text-sm text-slate-600">Real-time average</span>
                            </div>
                          </div>
                          <button
                            onClick={submitInterview}
                            disabled={getCurrentAverageScore() === 0 || submitting}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {submitting ? <LoadingSpinner /> : null}
                            {submitting ? 'Submitting...' : 'Submit Interview'}
                          </button>
                        </div>
                      </div>

                      {/* Interview Questions */}
                      {Object.keys(categories).length === 0 && !questionsLoading ? (
                        <div className="text-center py-16">
                          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-slate-900 mb-3">No Questions Available</h3>
                          <p className="text-slate-600 max-w-md mx-auto">No interview questions have been configured yet.</p>
                          <button
                            onClick={refreshQuestions}
                            className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                          >
                            Refresh Questions
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(categories).map(([catName, questions]) => {
                            const isOpen = openCategories.includes(catName);
                            return (
                              <div key={catName} className="bg-white/80 rounded-2xl border border-slate-200/50 shadow-sm">
                                <button
                                  onClick={() => toggleCategory(catName)}
                                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/50 transition-colors rounded-2xl"
                                >
                                  <div>
                                    <h3 className="text-lg font-bold text-slate-900">{catName}</h3>
                                    <p className="text-sm text-slate-600 mt-1">{questions.length} questions</p>
                                  </div>
                                  <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isOpen && (
                                  <div className="px-6 pb-6 space-y-6">
                                    {questions.map(question => {
                                      const response = candidateResponses(selectedCandidate?.id)[question.id] || {};
                                      const currentRating = response.rating || 0;
                                      const currentNote = response.noted || '';
                                      
                                      return (
                                        <div key={question.id} className="bg-white rounded-xl border border-slate-200/50 p-6 shadow-sm">
                                          <p className="text-slate-900 font-medium mb-6">{question.question_text}</p>
                                          
                                          {/* Rating */}
                                          <div className="mb-6">
                                            <label className="text-sm font-semibold text-slate-700 mb-3 block">Rating</label>
                                            <StarRating 
                                              rating={currentRating} 
                                              onRatingChange={(rating) => saveRating(question.id, rating)}
                                              disabled={savingResponse}
                                            />
                                          </div>
                                          
                                          {/* Notes */}
                                          <div>
                                            <label className="text-sm font-semibold text-slate-700 mb-3 block">Notes</label>
                                            <textarea
                                              rows={3}
                                              value={currentNote}
                                              onChange={(e) => saveNote(question.id, e.target.value)}
                                              placeholder="Add your evaluation notes..."
                                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 resize-none"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Discussion */}
              {activeStep === 'discussion' && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Discussion Phase</h2>
                      <p className="text-slate-600 mt-1">Candidate under team review</p>
                    </div>
                  </div>

                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="w-10 h-10 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-3">External Discussion in Progress</h3>
                    <p className="text-slate-600 max-w-lg mx-auto mb-8">
                      The candidate is currently being discussed by the evaluation team. 
                      Please proceed to the final decision when discussions are complete.
                    </p>
                    <button
                      onClick={() => setActiveStep('final')}
                      className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all duration-300"
                    >
                      Proceed to Final Decision
                    </button>
                  </div>
                </div>
              )}

              {/* Final Decision */}
              {activeStep === 'final' && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Final Decision</h2>
                      <p className="text-slate-600 mt-1">
                        {selectedCandidate ? `Decision for: ${selectedCandidate.fullName}` : 'Select candidate for final decision'}
                      </p>
                    </div>
                  </div>

                  {selectedCandidate ? (
                    <div className="space-y-8">
                      {/* Candidate Summary */}
                      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200/50 p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Candidate Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <User className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-600">Name:</span>
                              <span className="font-semibold text-slate-900">{selectedCandidate.fullName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <GraduationCap className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-600">Position:</span>
                              <span className="font-semibold text-slate-900">{selectedCandidate.positionAppliedFor}</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Star className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-600">Score:</span>
                              <span className={`px-3 py-1 rounded-lg border font-bold ${ratingColorClass(selectedCandidate.interviewScore || 0)}`}>
                                {selectedCandidate.interviewScore?.toFixed(1) || '0.0'} / 5.0
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <AlertCircle className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-600">Status:</span>
                              <span className={`px-3 py-1 rounded-lg border font-semibold text-xs flex items-center gap-2 ${getStatusColor(selectedCandidate.status)}`}>
                                {getStatusIcon(selectedCandidate.status)}
                                {selectedCandidate.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Decision Form */}
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700">Hourly Rate (USD)</label>
                            <input
                              type="number"
                              value={finalDecision.hourlyRate}
                              onChange={(e) => setFinalDecision(prev => ({ ...prev, hourlyRate: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200 bg-white/50"
                              placeholder="85"
                            />
                          </div>
                          
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700">Evaluator Name</label>
                            <input
                              type="text"
                              value={finalDecision.evaluator}
                              onChange={(e) => setFinalDecision(prev => ({ ...prev, evaluator: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200 bg-white/50"
                              placeholder="Dr. Robert Smith"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-slate-700">Reason for Rate</label>
                          <textarea
                            rows={4}
                            value={finalDecision.rateReason}
                            onChange={(e) => setFinalDecision(prev => ({ ...prev, rateReason: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200 bg-white/50 resize-none"
                            placeholder="Explain the reasoning for the hourly rate decision..."
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-slate-700">Rejection Reason (if applicable)</label>
                          <textarea
                            rows={4}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all duration-200 bg-white/50 resize-none"
                            placeholder="Enter reason for rejection if applicable..."
                          />
                        </div>

                        <div className="flex justify-end gap-4 pt-6 border-t border-slate-200/50">
                          <button
                            onClick={() => {
                              handleUpdateCandidateStatus(selectedCandidate.id, 'rejected', {
                                rejectionReason
                              });
                            }}
                            disabled={submitting}
                            className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-red-500 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-all duration-300 disabled:opacity-50"
                          >
                            {submitting ? <LoadingSpinner /> : <XCircle className="w-5 h-5" />}
                            {submitting ? 'Processing...' : 'Reject Candidate'}
                          </button>
                          <button
                            onClick={() => {
                              handleUpdateCandidateStatus(selectedCandidate.id, 'accepted', {
                                hourlyRate: parseFloat(finalDecision.hourlyRate) || null,
                                evaluator: finalDecision.evaluator,
                                rateReason: finalDecision.rateReason
                              });
                            }}
                            disabled={submitting}
                            className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                          >
                            {submitting ? <LoadingSpinner /> : <CheckCircle className="w-5 h-5" />}
                            {submitting ? 'Processing...' : 'Accept Candidate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <DollarSign className="w-10 h-10 text-slate-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-3">Select a Candidate</h3>
                      <p className="text-slate-600 max-w-md mx-auto">Choose a candidate from the sidebar to make the final hiring decision.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Sidebar - Candidates List */}
          <div className="xl:col-span-1">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 sticky top-32">
              <div className="p-6 border-b border-slate-200/50">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Candidates</h3>
                
                {/* Search */}
                <div className="relative mb-6">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Search candidates..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-white/50 text-sm"
                  />
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200/50">
                    <div className="text-lg font-bold text-blue-900">{candidates.filter(c => c.status === 'accepted').length}</div>
                    <div className="text-xs text-blue-700">Accepted</div>
                  </div>
                  <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-3 border border-amber-200/50">
                    <div className="text-lg font-bold text-amber-900">
                      {candidates.filter(c => ['pending', 'interview'].includes(c.status)).length}
                    </div>
                    <div className="text-xs text-amber-700">Pending</div>
                  </div>
                </div>
              </div>

              <div className="p-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                {candidatesLoading && candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="w-8 h-8" />
                    <p className="text-slate-600 text-sm mt-3">Loading candidates...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCandidates.map(candidate => (
                      <div
                        key={candidate.id}
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          if (candidate.status === 'pending' || candidate.status === 'interview') setActiveStep('interview');
                          else if (candidate.status === 'discussion') setActiveStep('discussion');
                          else if (['accepted', 'rejected'].includes(candidate.status)) setActiveStep('final');
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg group ${
                          selectedCandidate?.id === candidate.id 
                            ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg shadow-blue-500/20' 
                            : 'border-slate-200/50 bg-white/50 hover:border-slate-300 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                              {candidate.fullName}
                            </h4>
                            <p className="text-xs text-slate-600 mb-2">{candidate.positionAppliedFor}</p>
                            
                            {/* Status Badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(candidate.status)}`}>
                              {getStatusIcon(candidate.status)}
                              <span className="capitalize">{candidate.status}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewQuestionsCandidate(candidate);
                                setShowViewQuestionsModal(true);
                              }}
                              className="p-2 rounded-lg bg-white/80 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all duration-200"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCandidateToDelete(candidate);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 rounded-lg bg-white/80 border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-all duration-200"
                              title="Delete candidate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Interview Details */}
                        <div className="space-y-2">
                          {candidate.interviewDate && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formatDate(candidate.interviewDate)}</span>
                            </div>
                          )}
                          
                          {candidate.interviewScore && (
                            <div className="flex items-center gap-2 text-xs">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-slate-600">Score:</span>
                              <span className={`px-2 py-1 rounded-md font-semibold ${ratingColorClass(candidate.interviewScore)}`}>
                                {candidate.interviewScore.toFixed(1)}/5.0
                              </span>
                            </div>
                          )}

                          {candidate.hourlyRate && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>${candidate.hourlyRate}/hour</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Load More Trigger */}
                    {pagination.hasMore && (
                      <div ref={loadMoreRef} className="text-center py-4">
                        <LoadingSpinner />
                        <p className="text-sm text-slate-600 mt-2">Loading more candidates...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {!candidatesLoading && filteredCandidates.length === 0 && (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 text-sm">
                      {candidateSearch ? 'No candidates found matching your search' : 'No candidates found'}
                    </p>
                    {candidateSearch && (
                      <button
                        onClick={() => setCandidateSearch('')}
                        className="mt-2 text-blue-600 text-sm hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-white/60 w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Candidate</h3>
              <p className="text-slate-600">
                Are you sure you want to delete <span className="font-semibold">{candidateToDelete?.fullName}</span>? 
                This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCandidate}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/30 hover:shadow-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <LoadingSpinner /> : null}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Questions Modal */}
      {showViewQuestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-white/60 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                    Candidate Details
                  </h3>
                  <p className="text-slate-600 mt-1">{viewQuestionsCandidate?.fullName}</p>
                </div>
                <button
                  onClick={() => setShowViewQuestionsModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium">{viewQuestionsCandidate?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-medium">{viewQuestionsCandidate?.phone}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Position:</span>
                    <span className="font-medium">{viewQuestionsCandidate?.positionAppliedFor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Interview:</span>
                    <span className="font-medium">
                      {viewQuestionsCandidate?.interviewDate ? formatDate(viewQuestionsCandidate.interviewDate) : 'Not scheduled'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center py-8">
                <MessageCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">Additional candidate details and interview responses would be displayed here</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
