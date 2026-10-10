import { redirect } from 'next/navigation'

// Trial / Regular boxes is now split into Trials and Customers.
export default function Boxes() {
  redirect('/trials')
}
