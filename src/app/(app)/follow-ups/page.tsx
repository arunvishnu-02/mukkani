import { redirect } from 'next/navigation'

// The follow-ups screen is now the call register.
export default function FollowUps() {
  redirect('/calls')
}
