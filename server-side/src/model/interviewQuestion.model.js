import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export const InterviewQuestion = sequelize.define('InterviewQuestion', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    category: { 
        type: DataTypes.ENUM(
        'Academic & Professional Background',
        'Teaching Philosophy & Methodology',
        'Curriculum & Assessment',
        'Student Engagement & Support',
        'Research & Professional Development',
        'Collaboration & Institutional Contribution',
        'Adaptability & Problem-Solving',
        'Vision & Fit'
        ),
        allowNull: false
    }
}, {
    tableName: 'interview_questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export const CandidateQuestion = sequelize.define('CandidateQuestion', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    candidate_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    question_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: true },
    rating: { type: DataTypes.DECIMAL(5,2), allowNull: true },
    noted: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'candidate_questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default InterviewQuestion;
