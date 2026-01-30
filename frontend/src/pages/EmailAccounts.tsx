import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailAccountsAPI, authAPI } from '../lib/api';
import { Plus, Trash2, Power, TestTube } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../lib/utils';

export default function EmailAccounts() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailAccountsAPI.getAll().then(res => res.data.accounts),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await authAPI.getGmailAuthUrl();
      window.location.href = data.authUrl;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      emailAccountsAPI.update(id, { isActive: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Account updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailAccountsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Account disconnected');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => emailAccountsAPI.test(id),
    onSuccess: () => {
      toast.success('Connection test successful!');
    },
    onError: () => {
      toast.error('Connection test failed');
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Email Accounts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect and manage your email accounts
          </p>
        </div>
        <button
          onClick={() => connectMutation.mutate()}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Gmail</span>
        </button>
      </div>

      {accounts && accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No email accounts connected
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Connect your Gmail account to start automating order acceptance
            </p>
            <button
              onClick={() => connectMutation.mutate()}
              className="btn btn-primary"
            >
              Connect Gmail Account
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts?.map((account: any) => (
            <div key={account.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {account.email}
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`badge ${account.isActive ? 'badge-success' : 'badge-error'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="badge badge-info">{account.provider}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last checked: {account.lastChecked 
                      ? formatDate(account.lastChecked)
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleMutation.mutate({ 
                    id: account.id, 
                    isActive: account.isActive 
                  })}
                  className={`btn flex-1 ${account.isActive ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={toggleMutation.isPending}
                >
                  <Power className="w-4 h-4 mr-2" />
                  {account.isActive ? 'Pause' : 'Activate'}
                </button>

                <button
                  onClick={() => testMutation.mutate(account.id)}
                  className="btn btn-secondary"
                  disabled={testMutation.isPending}
                  title="Test connection"
                >
                  <TestTube className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to disconnect this account?')) {
                      deleteMutation.mutate(account.id);
                    }
                  }}
                  className="btn btn-danger"
                  disabled={deleteMutation.isPending}
                  title="Delete account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
