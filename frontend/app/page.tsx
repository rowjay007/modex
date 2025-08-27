import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Users, Award, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">Modex</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold text-gray-900 dark:text-white">
              Enterprise Learning Platform
            </h1>
            <p className="mb-8 text-xl text-gray-600 dark:text-gray-300">
              Scalable microservices architecture for modern learning management.
              Built with Next.js, Azure, and enterprise-grade infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/courses">
                <Button size="lg" className="w-full sm:w-auto">
                  Browse Courses
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
              Platform Features
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <BookOpen className="h-10 w-10 text-blue-600" />
                  <CardTitle>Course Management</CardTitle>
                  <CardDescription>
                    Comprehensive course creation and content management system
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-green-600" />
                  <CardTitle>Student Enrollment</CardTitle>
                  <CardDescription>
                    Streamlined enrollment process with progress tracking
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <Award className="h-10 w-10 text-purple-600" />
                  <CardTitle>Assessments</CardTitle>
                  <CardDescription>
                    Interactive quizzes and automated grading system
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-orange-600" />
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription>
                    Real-time performance tracking and insights
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
              Enterprise Architecture
            </h2>
            <p className="mb-8 text-lg text-gray-600 dark:text-gray-300">
              Built on Azure with microservices, Kubernetes, and modern DevOps practices
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
                <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">Cloud Native</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Azure Kubernetes Service with auto-scaling
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-6 dark:bg-green-900/20">
                <h3 className="mb-2 font-semibold text-green-900 dark:text-green-100">Microservices</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Independent, scalable service architecture
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 p-6 dark:bg-purple-900/20">
                <h3 className="mb-2 font-semibold text-purple-900 dark:text-purple-100">DevOps</h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  CI/CD with GitHub Actions and Terraform
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>&copy; 2024 Modex Learning Platform. Enterprise-grade microservices architecture.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
