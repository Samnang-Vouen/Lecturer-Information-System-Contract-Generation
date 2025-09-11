import { useState, useEffect } from 'react';
import axiosInstance from '../lib/axios';

export const useResearchFields = () => {
  const [researchFields, setResearchFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchResearchFields = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/research-fields');
      setResearchFields(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching research fields:', err);
      setError('Failed to fetch research fields');
      setResearchFields([]);
    } finally {
      setLoading(false);
    }
  };

  const createResearchField = async (name) => {
    try {
      const response = await axiosInstance.post('/research-fields', { name });
      const newField = response.data;
      setResearchFields(prev => [...prev, newField].sort((a, b) => a.name.localeCompare(b.name)));
      return newField;
    } catch (err) {
      console.error('Error creating research field:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchResearchFields();
  }, []);

  return {
    researchFields,
    loading,
    error,
    refetch: fetchResearchFields,
    createResearchField
  };
};
