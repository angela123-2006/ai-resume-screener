import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';
import { AlertCircle, Lock, Mail, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const loginSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSessionExpired = searchParams.get('session_expired') === 'true';
  const registerSuccess = searchParams.get('registered') === 'true';

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await authApi.login(values);
      await login(res.access_token);
      
      const role = localStorage.getItem('user_role');
      if (role === 'recruiter') {
        navigate('/dashboard');
      } else {
        navigate('/my-resumes');
      }
    } catch (err: any) {
      console.error(err);
      setServerError(
        err.response?.data?.detail || 'Invalid email or password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="ai-glow-bg" />

      {/* Decorative Neon Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-purple/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="glass-card px-8 py-10 rounded-3xl space-y-6 relative overflow-hidden">
          {/* Subtle Glow Overlay */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent" />
          
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-brand-purple/35 text-brand-cyan mb-2 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
              AI Resume Screener
            </h2>
            <p className="text-sm text-slate-400">
              Futuristic ATS & Candidate Assessment Engine
            </p>
          </div>

          {isSessionExpired && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-400 flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>Your session has expired. Please log in again.</span>
            </div>
          )}

          {registerSuccess && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
              Registration successful! Please log in with your credentials.
            </div>
          )}

          {serverError && (
            <div className="rounded-xl bg-red-550/10 bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all ${
                    errors.email ? 'border-red-500/50 focus:ring-red-500/30' : ''
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all ${
                    errors.password ? 'border-red-500/50 focus:ring-red-500/30' : ''
                  }`}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-gradient flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 mt-6 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Access Dashboard'
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-sm text-slate-500">
              New to the platform?{' '}
            </span>
            <Link
              to="/register"
              className="text-sm font-bold text-brand-cyan hover:text-cyan-300 transition-colors"
            >
              Initialize Account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
