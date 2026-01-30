import { useQuery } from '@tanstack/react-query';
import { statsAPI } from '../lib/api';
import { Mail, Filter, CheckCircle, XCircle, TrendingUp, Clock } from 'lucide-react';
import { formatNumber, formatRelativeTime } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => statsAPI.getDashboard().then(res => res.data),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Email Accounts',
      value: stats?.overview.emailAccounts || 0,
      icon: Mail,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Active Rules',
      value: stats?.overview.activeRules || 0,
      icon: Filter,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Orders Accepted',
      value: stats?.overview.accepted || 0,
      icon: CheckCircle,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Failed',
      value: stats?.overview.failed || 0,
      icon: XCircle,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor your email automation system performance
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.title}
                </p>
                <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                  {formatNumber(stat.value)}
                </p>
              </div>
              <div className={`${stat.iconBg} p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Success rate and metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center mb-3">
            <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Success Rate</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-4xl font-semibold text-green-600 dark:text-green-500">
              {stats?.overview.successRate || 0}%
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Overall acceptance rate
            </p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center mb-3">
            <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Last 24h</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-4xl font-semibold text-blue-600 dark:text-blue-500">
              {stats?.overview.last24h || 0}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Emails processed
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Status Breakdown
          </h3>
          <div className="space-y-2">
            {stats?.statusBreakdown && Object.keys(stats.statusBreakdown).length > 0 ? (
              Object.entries(stats.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {status.toLowerCase()}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {count as number}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity chart */}
      {stats?.dailyStats && stats.dailyStats.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Daily Activity (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent emails table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Recent Emails</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  From
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rule
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats?.recentEmails && stats.recentEmails.length > 0 ? (
                stats.recentEmails.map((email: any) => (
                  <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">
                      {email.from}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-5 py-3">
                      {email.rule ? (
                        <span className="badge badge-info">{email.rule.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No rule</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`badge ${
                          email.status === 'ACCEPTED'
                            ? 'badge-success'
                            : email.status === 'FAILED'
                            ? 'badge-error'
                            : 'badge-warning'
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatRelativeTime(email.receivedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center">
                      <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="font-medium">No emails yet</p>
                      <p className="text-xs mt-1">
                        Connect an email account and create rules to start processing
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top rules */}
      {stats?.topRules && stats.topRules.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Top Performing Rules
          </h3>
          <div className="space-y-3">
            {stats.topRules.map((rule: any) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {rule.matchCount} matches · {rule.successCount} accepted
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {rule.successRate}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">success</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
