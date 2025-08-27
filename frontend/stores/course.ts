import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Course {
  id: string
  title: string
  description: string
  instructor: string
  duration: string
  students: number
  rating: number
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  price: number
  thumbnail?: string
  modules?: Module[]
}

export interface Module {
  id: string
  title: string
  description: string
  duration: string
  lessons: Lesson[]
}

export interface Lesson {
  id: string
  title: string
  content: string
  duration: string
  videoUrl?: string
  completed: boolean
}

interface CourseState {
  courses: Course[]
  currentCourse: Course | null
  enrolledCourses: string[]
  favorites: string[]
  
  // Actions
  setCourses: (courses: Course[]) => void
  setCurrentCourse: (course: Course | null) => void
  addToEnrolled: (courseId: string) => void
  removeFromEnrolled: (courseId: string) => void
  toggleFavorite: (courseId: string) => void
  updateProgress: (courseId: string, lessonId: string, completed: boolean) => void
}

export const useCourseStore = create<CourseState>()(
  devtools(
    (set, get) => ({
      courses: [],
      currentCourse: null,
      enrolledCourses: [],
      favorites: [],

      setCourses: (courses: Course[]) => {
        set({ courses }, false, 'course/setCourses')
      },

      setCurrentCourse: (course: Course | null) => {
        set({ currentCourse: course }, false, 'course/setCurrentCourse')
      },

      addToEnrolled: (courseId: string) => {
        const { enrolledCourses } = get()
        if (!enrolledCourses.includes(courseId)) {
          set({ 
            enrolledCourses: [...enrolledCourses, courseId] 
          }, false, 'course/addToEnrolled')
        }
      },

      removeFromEnrolled: (courseId: string) => {
        const { enrolledCourses } = get()
        set({ 
          enrolledCourses: enrolledCourses.filter(id => id !== courseId) 
        }, false, 'course/removeFromEnrolled')
      },

      toggleFavorite: (courseId: string) => {
        const { favorites } = get()
        const isFavorite = favorites.includes(courseId)
        
        set({ 
          favorites: isFavorite 
            ? favorites.filter(id => id !== courseId)
            : [...favorites, courseId]
        }, false, 'course/toggleFavorite')
      },

      updateProgress: (courseId: string, lessonId: string, completed: boolean) => {
        const { courses } = get()
        const updatedCourses = courses.map(course => {
          if (course.id === courseId && course.modules) {
            return {
              ...course,
              modules: course.modules.map(module => ({
                ...module,
                lessons: module.lessons.map(lesson =>
                  lesson.id === lessonId ? { ...lesson, completed } : lesson
                )
              }))
            }
          }
          return course
        })
        
        set({ courses: updatedCourses }, false, 'course/updateProgress')
      },
    }),
    { name: 'CourseStore' }
  )
)
