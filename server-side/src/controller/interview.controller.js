import { Op } from 'sequelize';
import { InterviewQuestion, CandidateQuestion } from '../model/interviewQuestion.model.js';
import { activeInterviewCategories } from '../utils/seedInterviewQuestions.js';
import Candidate from '../model/candidate.model.js';

// GET /api/interview-questions
const normalize = (s='') => s.toLowerCase().trim().replace(/\s+/g,' ');

export const getInterviewQuestions = async (req, res) => {
  try {
    const defaultOnly = req.query.defaultOnly === '1' || req.query.defaultOnly === 'true';
    const where = {};
    if (defaultOnly) where.is_default = true; // only baseline set
    const rows = await InterviewQuestion.findAll({ where, order: [['category','ASC'], ['created_at','ASC']] });
    // Group by category
    const categories = {};
    for (const q of rows) {
      if (!activeInterviewCategories.includes(q.category)) continue; // skip inactive categories
      if (!categories[q.category]) categories[q.category] = [];
      categories[q.category].push({ id: q.id, question_text: q.question_text });
    }
    res.json({ categories });
  } catch (e) {
    console.error('getInterviewQuestions error', e);
    res.status(500).json({ message: 'Failed to fetch interview questions' });
  }
};

// POST /api/interview-questions
export const addInterviewQuestion = async (req, res) => {
  try {
  const { question_text, category } = req.body;
  if (!question_text || !category) return res.status(400).json({ message: 'question_text and category required' });
  const canonical_text = normalize(question_text);
  // Check duplicate
  const dup = await InterviewQuestion.findOne({ where: { category, canonical_text } });
  if (dup) return res.status(409).json({ message: 'Duplicate question exists', id: dup.id });
  const created = await InterviewQuestion.create({ question_text, canonical_text, category, is_default: false, is_custom: true });
    res.status(201).json(created);
  } catch (e) {
    console.error('addInterviewQuestion error', e);
    res.status(500).json({ message: 'Failed to create question' });
  }
};

// PUT /api/interview-questions/:id
export const updateInterviewQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text } = req.body;
    const row = await InterviewQuestion.findByPk(id);
    if (!row) return res.status(404).json({ message: 'Question not found' });
    if (question_text) {
      const canonical_text = normalize(question_text);
      // If canonical changes and another row already has it, block
      if (canonical_text !== row.canonical_text) {
        const existing = await InterviewQuestion.findOne({ where: { category: row.category, canonical_text } });
        if (existing && existing.id !== row.id) {
          return res.status(409).json({ message: 'Another question with same text exists', id: existing.id });
        }
      }
      await row.update({ question_text, canonical_text });
    }
    res.json(row);
  } catch (e) {
    console.error('updateInterviewQuestion error', e);
    res.status(500).json({ message: 'Failed to update question' });
  }
};

// GET /api/interview-questions/search?query=foo
export const searchInterviewQuestions = async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    if (!query) return res.json([]);
    const rows = await InterviewQuestion.findAll({
      where: { question_text: { [Op.like]: `%${query}%` } },
      limit: 100, // gather enough then dedupe
      order: [['question_text','ASC']]
    });
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (seen.has(r.canonical_text)) continue;
      seen.add(r.canonical_text);
      out.push({ id: r.id, question_text: r.question_text, category: r.category });
      if (out.length >= 15) break;
    }
    res.json(out);
  } catch (e) {
    console.error('searchInterviewQuestions error', e);
    res.status(500).json({ message: 'Failed to search questions' });
  }
};

// POST /api/candidate-questions
export const addCandidateQuestion = async (req, res) => {
  try {
    const { candidate_id, question_id, answer, rating, noted } = req.body;
    if (!candidate_id || !question_id) return res.status(400).json({ message: 'candidate_id and question_id required' });
    // Validate candidate exists
    const cand = await Candidate.findByPk(candidate_id);
    if (!cand) return res.status(404).json({ message: 'Candidate not found' });
    // Validate question exists
    const quest = await InterviewQuestion.findByPk(question_id);
    if (!quest) return res.status(404).json({ message: 'Question not found' });
    const created = await CandidateQuestion.create({ candidate_id, question_id, answer, rating, noted });
    res.status(201).json(created);
  } catch (e) {
    console.error('addCandidateQuestion error', e);
    res.status(500).json({ message: 'Failed to create candidate question' });
  }
};

// GET /api/candidates/:id/interview-details
export const getCandidateInterviewDetails = async (req, res) => {
  try {
    const { id } = req.params;
    // Pull all candidate question rows joined with question text & category
    const rows = await CandidateQuestion.findAll({
      where: { candidate_id: id },
      order: [['created_at','ASC']]
    });
    if (!rows.length) return res.json({ candidate_id: id, responses: [] });
    // Fetch distinct questions
    const qIds = [...new Set(rows.map(r => r.question_id))];
    const questions = await InterviewQuestion.findAll({ where: { id: qIds } });
    const qMap = new Map(questions.map(q => [q.id, q]));
    const responses = rows.map(r => ({
      id: r.id,
      question_id: r.question_id,
      question_text: qMap.get(r.question_id)?.question_text || '',
      category: qMap.get(r.question_id)?.category || '',
      rating: r.rating ? Number(r.rating) : null,
      noted: r.noted,
      created_at: r.created_at
    }));
    res.json({ candidate_id: id, responses });
  } catch (e) {
    console.error('getCandidateInterviewDetails error', e);
    res.status(500).json({ message: 'Failed to fetch interview details' });
  }
};

export default {
  getInterviewQuestions,
  addInterviewQuestion,
  updateInterviewQuestion,
  searchInterviewQuestions,
  addCandidateQuestion,
  getCandidateInterviewDetails
};
