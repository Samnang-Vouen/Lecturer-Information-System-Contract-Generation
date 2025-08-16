import { Op } from 'sequelize';
import { InterviewQuestion, CandidateQuestion } from '../model/interviewQuestion.model.js';
import Candidate from '../model/candidate.model.js';

// GET /api/interview-questions
export const getInterviewQuestions = async (_req, res) => {
  try {
    const rows = await InterviewQuestion.findAll({ order: [['category','ASC'], ['created_at','ASC']] });
    // Group by category
    const categories = {};
    for (const q of rows) {
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
    const created = await InterviewQuestion.create({ question_text, category });
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
    if (question_text) await row.update({ question_text });
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
      limit: 10,
      order: [['question_text','ASC']]
    });
    res.json(rows.map(r => ({ id: r.id, question_text: r.question_text, category: r.category })));
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

export default {
  getInterviewQuestions,
  addInterviewQuestion,
  updateInterviewQuestion,
  searchInterviewQuestions,
  addCandidateQuestion
};
