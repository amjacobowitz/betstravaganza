import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-bold text-white">Sign In</h2>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-muted">
        No account?{' '}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </>
  )
}
