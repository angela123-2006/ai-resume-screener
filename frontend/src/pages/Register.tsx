import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { AlertCircle, Lock, Mail, User, Loader2, Sparkles, GraduationCap, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

const registerSchema = zod.object({
  name: zod.string().min(2, 'Name must be at least 2 characters'),
  email: zod.string().email('Please enter a valid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
  role: zod.enum(['candidate', 'recruiter']),
});

type RegisterFormValues = zod.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'candidate',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await authApi.register(values);
      navigate('/login?registered=true');
    } catch (err: any) {
      console.error(err);
      setServerError(
        err.response?.data?.detail || 'Registration failed. The email may already be in use.'
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
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-purple/50 to-transparent" />

          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-brand-purple/35 text-brand-cyan mb-2 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
              Create Account
            </h2>
            <p className="text-sm text-slate-400">
              Initialize your AI-driven screening profiles
            </p>
          </div>

          {serverError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  placeholder="John Doe"
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all ${
                    errors.name ? 'border-red-500/50 focus:ring-red-500/30' : ''
                  }`}
                  {...register('name')}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>

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

            {/* Role Switcher Redesign */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                Select Portal Access
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setValue('role', 'candidate')}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedRole === 'candidate'
                      ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan shadow-[0_0_10px_rgba(0,229,255,0.05)]'
                      : 'border-white/10 text-slate-400 bg-slate-950/20 hover:bg-slate-950/40'
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setValue('role', 'recruiter')}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedRole === 'recruiter'
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple shadow-[0_0_10px_rgba(110,86,207,0.05)]'
                      : 'border-white/10 text-slate-400 bg-slate-950/20 hover:bg-slate-950/40'
                  }`}
                >
                  <Briefcase className="h-4 w-4" />
                  Recruiter
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-gradient flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 mt-6 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing Account...
                </>
              ) : (
                'Create Credentials'
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-sm text-slate-500">
              Already possess an account?{' '}
            </span>
            <Link
              to="/login"
              className="text-sm font-bold text-brand-cyan hover:text-cyan-300 transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
