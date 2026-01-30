import { useQuery } from '@tanstack/react-query';
import { activityAPI } from '../lib/api';
import { formatRelativeTime, formatDate, getStatusColor } from '../lib/utils';
import { Mail } from 'lucide-react';

export default function Activity() {
  const { data: emails, isLoading } = useQuery({
    queryKey: ['processed-emails'],
    queryFn: () => activityAPI.getEmails({ limit: 100 }).then(res => res.data.emails),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Activity Feed</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real-time monitoring of email processing and order acceptance
        </p>
      </div>

      {/* Activity table */}
      <div className="card">
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
                  Account
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rule
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Processed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {emails && emails.length > 0 ? (
                emails.map((email: any) => (
                  <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">
                      {email.from}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {email.emailAccount.email}
                    </td>
                    <td className="px-5 py-3">
                      {email.rule ? (
                        <span className="badge badge-info">{email.rule.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No rule</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${getStatusColor(email.status)}`}>
                        {email.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400" title={formatDate(email.receivedAt)}>
                      {formatRelativeTime(email.receivedAt)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400" title={formatDate(email.processedAt)}>
                      {formatRelativeTime(email.processedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        No activity yet
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
    </div>
  );
}
