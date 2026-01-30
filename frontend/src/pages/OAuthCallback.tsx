import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { emailAccountsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const email = searchParams.get('email');
      const expiresIn = searchParams.get('expires_in');

      if (!accessToken || !email) {
        toast.error('Authorization failed');
        navigate('/email-accounts');
        return;
      }

      try {
        await emailAccountsAPI.create({
          email,
          accessToken,
          refreshToken: refreshToken || undefined,
          expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
        });
        
        toast.success('Email account connected successfully!');
        navigate('/email-accounts');
      } catch (error: any) {
        toast.error(error.response?.data?.error?.message || 'Failed to connect account');
        navigate('/email-accounts');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Connecting your account...
        </h2>
        <p className="text-gray-600">Please wait while we set up your email account.</p>
      </div>
    </div>
  );
}
