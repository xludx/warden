import { useEffect, useState } from 'react';
import { api, type User, type Application } from '../lib/api';

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listUsers(), api.listApplications()])
      .then(([u, a]) => {
        setUsers(u);
        setApps(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  const stats = [
    { label: 'Users', value: users.length },
    { label: 'Applications', value: apps.length },
    { label: 'Service Accounts', value: users.filter((u) => u.type === 'service').length },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
