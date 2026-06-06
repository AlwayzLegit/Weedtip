import { redirect } from 'next/navigation';

// Brand management moved to the standalone Brand Studio portal, which is
// accessible to any brand owner (not just dispensary owners).
export default function DashboardBrandsRedirect() {
  redirect('/studio');
}
