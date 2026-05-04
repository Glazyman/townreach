import { Dashboard } from "@/components/dashboard";
import { getInitialDashboardData } from "@/lib/data";

export default function PastSearchesRoutePage() {
  const data = getInitialDashboardData();
  return <Dashboard data={data} />;
}
