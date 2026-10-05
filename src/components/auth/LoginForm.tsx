'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid username or password');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
      <div className="bg-white rounded-[16px] border border-[#e5e7eb] w-full max-w-[380px] p-[32px_24px] mx-4 shadow-sm">
         <div style={{ 
           textAlign: 'center', 
           marginBottom: '24px',
           display: 'flex',
           justifyContent: 'center' 
         }}>
           <img
             src="/logo.svg"
             alt="Saikat Enterprise"
             width={200}
             height={90}
             style={{ objectFit: 'contain' }}
           />
         </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="mb-[14px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 ml-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="w-full h-[46px] rounded-[10px] border-[1.5px] border-[#e5e7eb] px-3 text-[15px] text-gray-900 outline-none focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] transition-all disabled:opacity-50 disabled:bg-gray-50"
              required
            />
          </div>

          <div className="mb-[20px] relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full h-[46px] rounded-[10px] border-[1.5px] border-[#e5e7eb] pl-3 pr-10 text-[15px] text-gray-900 outline-none focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] transition-all disabled:opacity-50 disabled:bg-gray-50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-[12px] bg-[#fef2f2] text-[#dc2626] text-[13px] text-center rounded-[8px] py-2 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[48px] bg-[#16a34a] text-white rounded-[10px] text-[15px] font-semibold hover:bg-[#15803d] active:bg-[#166534] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          Authorized access only
        </p>
      </div>
    </div>
  );
}
