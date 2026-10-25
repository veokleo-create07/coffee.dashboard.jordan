export default function DashboardLoading() {
  return <div className="dashboard-route-loading" aria-busy="true" aria-label="Loading dashboard">
    <div className="dashboard-loading-heading"><span /><span /></div>
    <div className="dashboard-loading-metrics"><i /><i /><i /><i /></div>
    <div className="dashboard-loading-panel" />
  </div>;
}
