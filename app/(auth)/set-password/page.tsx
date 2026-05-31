import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

export default function SetPasswordPage() {
  return (
    <>
      <h2 className="mb-2 text-xl font-bold text-white">Set Your Password</h2>
      <p className="mb-6 text-sm text-muted">Choose a password you'll use to sign in from now on.</p>
      <SetPasswordForm />
    </>
  )
}
