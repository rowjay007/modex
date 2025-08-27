import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// API methods
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  register: (userData: { email: string; password: string; name: string }) =>
    api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
}

export const coursesAPI = {
  getAll: () => api.get('/api/courses'),
  getById: (id: string) => api.get(`/api/courses/${id}`),
  create: (courseData: any) => api.post('/api/courses', courseData),
  update: (id: string, courseData: any) => api.put(`/api/courses/${id}`, courseData),
  delete: (id: string) => api.delete(`/api/courses/${id}`),
}

export const enrollmentAPI = {
  enroll: (courseId: string) => api.post('/api/enrollments', { courseId }),
  getUserEnrollments: (userId: string) => api.get(`/api/enrollments/user/${userId}`),
  updateProgress: (id: string, progress: number) =>
    api.put(`/api/enrollments/${id}/progress`, { progress }),
}

export const assessmentAPI = {
  getAll: () => api.get('/api/assessments'),
  getById: (id: string) => api.get(`/api/assessments/${id}`),
  create: (assessmentData: any) => api.post('/api/assessments', assessmentData),
  submit: (submissionData: any) => api.post('/api/submissions', submissionData),
  getGrade: (id: string) => api.get(`/api/submissions/${id}/grade`),
}

export const paymentAPI = {
  createPayment: (paymentData: any) => api.post('/api/payments', paymentData),
  getSubscriptions: () => api.get('/api/subscriptions'),
  createSubscription: (subscriptionData: any) =>
    api.post('/api/subscriptions', subscriptionData),
}

export const analyticsAPI = {
  trackEvent: (eventData: any) => api.post('/api/analytics/events', eventData),
  getDashboard: () => api.get('/api/analytics/dashboard'),
  getCourseAnalytics: (courseId: string) => api.get(`/api/analytics/courses/${courseId}`),
}
