import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rulesAPI, emailAccountsAPI } from '../lib/api';
import { Plus, X, Edit, Trash2, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface RuleFormData {
  name: string;
  description: string;
  emailAccountId: string;
  matchSubject: string;
  matchFrom: string;
  matchBody: string;
  action: 'ACCEPT' | 'REJECT' | 'FORWARD' | 'SEND_CONFIRMATION';
  priority: number;
  isActive: boolean;
  confirmationSubject?: string;
  confirmationBody?: string;
}

export default function Rules() {
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: rules } = useQuery({
    queryKey: ['rules'],
    queryFn: () => rulesAPI.getAll().then(res => res.data.rules),
  });

  const { data: accounts } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailAccountsAPI.getAll().then(res => res.data.accounts),
  });

  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    emailAccountId: '',
    matchSubject: '',
    matchFrom: '',
    matchBody: '',
    action: 'ACCEPT',
    priority: 1,
    isActive: true,
    confirmationSubject: '',
    confirmationBody: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: RuleFormData) => rulesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule created successfully');
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RuleFormData> }) =>
      rulesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule updated successfully');
      setShowModal(false);
      setEditingRule(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete rule');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      rulesAPI.update(id, { isActive: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule updated');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      emailAccountId: '',
      matchSubject: '',
      matchFrom: '',
      matchBody: '',
      action: 'ACCEPT',
      priority: 1,
      isActive: true,
      confirmationSubject: '',
      confirmationBody: '',
    });
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    resetForm();
    setShowModal(true);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      emailAccountId: rule.emailAccountId,
      matchSubject: rule.conditions?.matchSubject || '',
      matchFrom: rule.conditions?.matchFrom || '',
      matchBody: rule.conditions?.matchBody || '',
      action: rule.action,
      priority: rule.priority,
      isActive: rule.isActive,
      confirmationSubject: rule.confirmationSubject || '',
      confirmationBody: rule.confirmationBody || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.emailAccountId) {
      toast.error('Please fill in required fields');
      return;
    }

    if (formData.action === 'SEND_CONFIRMATION') {
      if (!formData.confirmationSubject || !formData.confirmationBody) {
        toast.error('Please fill in confirmation email subject and body');
        return;
      }
    }

    const ruleData = {
      name: formData.name,
      description: formData.description,
      emailAccountId: formData.emailAccountId,
      matchSubject: formData.matchSubject,
      matchFrom: formData.matchFrom,
      matchBody: formData.matchBody,
      action: formData.action,
      priority: formData.priority,
      isActive: formData.isActive,
      confirmationSubject: formData.confirmationSubject,
      confirmationBody: formData.confirmationBody,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: ruleData });
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const handleDeleteRule = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the rule "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Automation Rules</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure rules to automatically process emails
          </p>
        </div>
        <button onClick={handleCreateRule} className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Rule</span>
        </button>
      </div>

      {rules && rules.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No rules configured
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Create your first automation rule to start processing emails
          </p>
          <button onClick={handleCreateRule} className="btn btn-primary">
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules?.map((rule: any) => (
            <div key={rule.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {rule.name}
                  </h3>
                  {rule.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{rule.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className={`badge ${rule.isActive ? 'badge-success' : 'badge-error'}`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="badge badge-info">
                      {rule.emailAccount.email}
                    </span>
                    <span className="badge badge-neutral">
                      Priority: {rule.priority}
                    </span>
                    <span className="badge badge-neutral">
                      Action: {rule.action}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Matches: {rule.matchCount} · Success: {rule.successCount} · Failed: {rule.failureCount}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, isActive: rule.isActive })}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={rule.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRule(null);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Order Acceptance Rule"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Describe what this rule does..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Account *
                </label>
                <select
                  value={formData.emailAccountId}
                  onChange={(e) => setFormData({ ...formData, emailAccountId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select an email account</option>
                  {accounts?.map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Match Conditions (at least one required)
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subject Contains
                    </label>
                    <input
                      type="text"
                      value={formData.matchSubject}
                      onChange={(e) => setFormData({ ...formData, matchSubject: e.target.value })}
                      className="input"
                      placeholder="e.g., Order, Purchase"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      From Email
                    </label>
                    <input
                      type="text"
                      value={formData.matchFrom}
                      onChange={(e) => setFormData({ ...formData, matchFrom: e.target.value })}
                      className="input"
                      placeholder="e.g., orders@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Body Contains
                    </label>
                    <input
                      type="text"
                      value={formData.matchBody}
                      onChange={(e) => setFormData({ ...formData, matchBody: e.target.value })}
                      className="input"
                      placeholder="e.g., confirm order"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Action *
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                    className="input"
                    required
                  >
                    <option value="ACCEPT">Accept</option>
                    <option value="REJECT">Reject</option>
                    <option value="FORWARD">Forward</option>
                    <option value="SEND_CONFIRMATION">Send Confirmation Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Activate rule immediately
                </label>
              </div>

              {formData.action === 'SEND_CONFIRMATION' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Confirmation Email Template
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Subject *
                      </label>
                      <input
                        type="text"
                        value={formData.confirmationSubject}
                        onChange={(e) =>
                          setFormData({ ...formData, confirmationSubject: e.target.value })
                        }
                        className="input"
                        placeholder="Order Confirmed! #{{orderNumber}}"
                        required={formData.action === 'SEND_CONFIRMATION'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Body *
                      </label>
                      <textarea
                        value={formData.confirmationBody}
                        onChange={(e) => setFormData({ ...formData, confirmationBody: e.target.value })}
                        className="input font-mono text-sm"
                        rows={10}
                        placeholder={`Hi {{customerName}},\n\n🎉 Your order #{{orderNumber}} has been confirmed!\n\nOrder Details:\n- Product: {{product}}\n- Quantity: {{quantity}}\n- Total: {{price}}\n- Date: {{orderDate}}\n\nThank you for shopping with us!\n\nBest regards,\nThe Store Team`}
                        required={formData.action === 'SEND_CONFIRMATION'}
                      />
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                        📝 Available Template Variables:
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{orderNumber}}`}</code> - Order #</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{customerName}}`}</code> - Customer name</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{price}}`}</code> - Total amount</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{product}}`}</code> - Product name</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{quantity}}`}</code> - Quantity</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{orderDate}}`}</code> - Order date</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{productId}}`}</code> - Product ID/SKU</span>
                        <span><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{customerEmail}}`}</code> - Customer email</span>
                      </div>
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                        Variables are auto-extracted from incoming emails
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRule
                    ? 'Update Rule'
                    : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
