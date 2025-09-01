import { useState, useEffect } from 'react';
import axiosInstance from '../lib/axios';

export const useUniversities = () => {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUniversities = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/universities');
      setUniversities(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching universities:', err);
      setError('Failed to fetch universities');
    } finally {
      setLoading(false);
    }
  };

  const createUniversity = async (name) => {
    try {
      const response = await axiosInstance.post('/universities', { name });
      setUniversities(prev => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      return response.data;
    } catch (err) {
      console.error('Error creating university:', err);
      if (err.response?.status === 409) {
        throw new Error('University already exists');
      }
      throw new Error('Failed to create university');
    }
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  return {
    universities,
    loading,
    error,
    refetch: fetchUniversities,
    createUniversity
  };
};
