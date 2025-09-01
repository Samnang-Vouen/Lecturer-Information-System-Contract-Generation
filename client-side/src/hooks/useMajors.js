import { useState, useEffect } from 'react';
import axiosInstance from '../lib/axios';

export const useMajors = () => {
  const [majors, setMajors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMajors = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/majors');
      setMajors(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching majors:', err);
      setError('Failed to fetch majors');
      setMajors([]);
    } finally {
      setLoading(false);
    }
  };

  const createMajor = async (name) => {
    try {
      const response = await axiosInstance.post('/majors', { name });
      const newMajor = response.data;
      setMajors(prev => [...prev, newMajor].sort((a, b) => a.name.localeCompare(b.name)));
      return newMajor;
    } catch (err) {
      console.error('Error creating major:', err);
      if (err.response?.status === 409) {
        throw new Error('Major already exists');
      }
      throw new Error('Failed to create major');
    }
  };

  useEffect(() => {
    fetchMajors();
  }, []);

  return {
    majors,
    loading,
    error,
    refetch: fetchMajors,
    createMajor
  };
};
