import React, { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import { FileText, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { axiosInstance } from '../../lib/axios.js';

export default function ManagementHome(){
  const [stats, setStats] = useState({ total: 0, draft: 0, lecturerSigned: 0, managementSigned: 0, completed: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async ()=>{
      try {
        setLoading(true);
        // Fetch first page to compute status counts quickly (server could expose stats endpoint later)
        const res = await axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 100 } });
        const list = res.data?.data || [];
        const counts = list.reduce((acc, c) => { acc.total++; acc[c.status?.toLowerCase()] = (acc[c.status?.toLowerCase()]||0)+1; return acc; }, { total: 0 });
        setStats({
          total: counts.total || 0,
          draft: counts.draft || 0,
          lecturerSigned: counts['lecturer_signed'] || 0,
          managementSigned: counts['management_signed'] || 0,
          completed: counts.completed || 0,
        });
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const Card = ({ title, value, icon:Icon, color }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 shadow-sm">
      <div className={`p-2 rounded ${color.bg} ${color.text}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-semibold">{loading ? '…' : value}</div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of contracts requiring your approval</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="All Contracts" value={stats.total} icon={FileText} color={{bg:'bg-blue-50', text:'text-blue-700'}} />
        <Card title="Draft" value={stats.draft} icon={Clock} color={{bg:'bg-amber-50', text:'text-amber-700'}} />
        <Card title="Lecturer Signed" value={stats.lecturerSigned} icon={AlertCircle} color={{bg:'bg-sky-50', text:'text-sky-700'}} />
        <Card title="Completed" value={stats.completed} icon={CheckCircle2} color={{bg:'bg-green-50', text:'text-green-700'}} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Quick Actions</div>
          <TrendingUp className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={()=> window.location.href = '/management/contracts'}>Review Pending</Button>
        </div>
      </div>
    </div>
  );
}
