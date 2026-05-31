import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-bold text-white">Create Account</h2>
      <SignupForm />
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
