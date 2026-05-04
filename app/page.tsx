import { Dashboard } from "@/components/dashboard";
import { getInitialDashboardData } from "@/lib/data";

export default function Home() {
  const data = getInitialDashboardData();
  return <Dashboard data={data} />;
}
