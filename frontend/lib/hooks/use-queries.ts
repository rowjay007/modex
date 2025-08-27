import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authAPI, coursesAPI, enrollmentAPI } from '../api'
import { useAuthStore } from '@/stores/auth'
import { useCourseStore } from '@/stores/course'
import type { Course } from '@/stores/course'

// Auth queries
export const useLoginMutation = () => {
  const login = useAuthStore((state) => state.login)
  
  return useMutation({
    mutationFn: authAPI.login,
    onSuccess: (response) => {
      const { token, user } = response.data
      login(token, user)
    },
  })
}

export const useRegisterMutation = () => {
  return useMutation({
    mutationFn: authAPI.register,
  })
}

// Course queries
export const useCoursesQuery = () => {
  const setCourses = useCourseStore((state) => state.setCourses)
  
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const response = await coursesAPI.getAll()
      const courses = response.data
      setCourses(courses)
      return courses
    },
  })
}

export const useCourseQuery = (courseId: string) => {
  const setCurrentCourse = useCourseStore((state) => state.setCurrentCourse)
  
  return useQuery({
    queryKey: ['courses', courseId],
    queryFn: async () => {
      const response = await coursesAPI.getById(courseId)
      const course = response.data
      setCurrentCourse(course)
      return course
    },
    enabled: !!courseId,
  })
}

// Enrollment queries
export const useEnrollmentsQuery = (userId: string) => {
  return useQuery({
    queryKey: ['enrollments', userId],
    queryFn: async () => {
      const response = await enrollmentAPI.getUserEnrollments(userId)
      return response.data
    },
    enabled: !!userId,
  })
}

export const useEnrollMutation = () => {
  const queryClient = useQueryClient()
  const addToEnrolled = useCourseStore((state) => state.addToEnrolled)
  
  return useMutation({
    mutationFn: enrollmentAPI.enroll,
    onSuccess: (_, variables) => {
      addToEnrolled(variables.courseId)
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}

export const useProgressMutation = () => {
  const queryClient = useQueryClient()
  const updateProgress = useCourseStore((state) => state.updateProgress)
  
  return useMutation({
    mutationFn: ({ 
      enrollmentId, 
      progress 
    }: { 
      enrollmentId: string
      progress: number 
    }) => enrollmentAPI.updateProgress(enrollmentId, progress),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}
