import axios from 'axios';

export const axiosInstance = axios.create({
    baseURL: 'http://localhost:4000/api', 
    withCredentials: true, // Include credentials for CORS requests
});