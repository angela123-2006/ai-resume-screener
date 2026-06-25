import React, { useState } from 'react';
import { useJobs, useCreateJob, useDeleteJob } from '../hooks/useJobs';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Calendar, Trash2, Eye, Plus, AlertCircle, Loader2, X, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

const jobSchema = zod.object({
  title: zod.string().min(3, 'Title must be at least 3 characters'),
  description: zod.string().min(10, 'Description must be at least 10 characters'),
  location_type: zod.enum(['Remote', 'On-site', 'Hybrid']).default('On-site'),
  location: zod.string().optional(),
});

type JobFormValues = zod.infer<typeof jobSchema>;

export const JobsList: React.FC = () => {
  const { user } = useAuth();
  const { data: jobs, isLoading, error } = useJobs();
  const createMutation = useCreateJob();
  const deleteMutation = useDeleteJob();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isRecruiter = user?.role === 'recruiter';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema) as any,
    defaultValues: {
      location_type: 'On-site',
    }
  });

  const onSubmit = async (values: JobFormValues) => {
    try {
      await createMutation.mutateAsync(values);
      setShowCreateModal(false);
      reset();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (jobId: number) => {
    if (confirm('Are you sure you want to delete this job? All associated resume scores will be deleted too.')) {
      setDeletingId(jobId);
      try {
        await deleteMutation.mutateAsync(jobId);
      } catch (err) {
        console.error(err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-48 border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Careers & Postings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {isRecruiter
              ? 'Oversee active pipelines and perform assessments against role profiles'
              : 'Browse open opportunities and benchmark your skills'}
          </p>
        </div>
        {isRecruiter && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-violet transition-colors shadow-lg shadow-brand-purple/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Position
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch postings from DB.</span>
        </div>
      )}

      {jobs?.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center border border-white/5 bg-slate-900/40 backdrop-blur-md rounded-3xl p-16 text-center space-y-4">
          <motion.div 
            animate={{ y: [0, -10, 0] }} 
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="h-16 w-16 bg-slate-950 border border-white/10 text-brand-purple rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.15)]"
          >
            <Briefcase className="h-8 w-8" />
          </motion.div>
          <div>
            <h3 className="text-xl font-extrabold text-white">No Roles Created</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed">
              {isRecruiter
                ? 'Establish your first career opening to kick off the candidate ranking loop.'
                : 'No open career opportunities listed currently.'}
            </p>
          </div>
          {isRecruiter && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl btn-gradient px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-1 cursor-pointer mt-2"
            >
              <Plus className="h-5 w-5" />
              Create First Posting
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs?.map((job) => (
            <motion.div
              layout
              variants={itemVariants}
              key={job.id}
              className="glass-card glass-card-hover p-6 rounded-2xl flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-slate-100">{job.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {job.company && (
                        <div className="flex items-center gap-1.5 text-brand-cyan/80 font-semibold">
                          <span>{job.company.name}</span>
                        </div>
                      )}
                      {job.location_type && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          <span>{job.location_type}</span>
                          {job.location && <span className="text-slate-500 text-[10px] uppercase font-bold">• {job.location}</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(job.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-10 w-10 bg-brand-purple/10 text-brand-purple border border-brand-purple/20 rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5" />
                  </div>
                </div>

                <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                  {job.description}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-5 mt-6 border-t border-white/5">
                <Link
                  to={`/jobs/${job.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-950/40 hover:bg-brand-cyan/10 border border-white/5 hover:border-brand-cyan/20 text-slate-300 hover:text-brand-cyan text-xs font-bold transition-all"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isRecruiter ? 'Overview & Leaderboard' : 'Analyze Position'}
                </Link>
                
                {isRecruiter && (
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    title="Remove Role"
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Job Overlay Redesign */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg glass-card rounded-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/30">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-brand-cyan" />
                  Configure Open Role
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                    Role Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Machine Learning Engineer"
                    className={`w-full rounded-xl border px-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all ${
                      errors.title ? 'border-red-500/50 focus:ring-red-500/30' : ''
                    }`}
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-400">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                    Description & Core Stack
                  </label>
                  <textarea
                    rows={6}
                    placeholder="List stack, experience limits, and typical day-to-day requirements. Keeping this detailed ensures highly precise AI match scoring."
                    className={`w-full rounded-xl border px-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all resize-none ${
                      errors.description ? 'border-red-500/50 focus:ring-red-500/30' : ''
                    }`}
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-400">{errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                      Work Setup
                    </label>
                    <select
                      className="w-full rounded-xl border px-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all appearance-none"
                      {...register('location_type')}
                    >
                      <option value="On-site">On-site</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Remote">Remote</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">
                      Location (City, State)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. San Francisco, CA"
                      className="w-full rounded-xl border px-4 py-3 bg-slate-950/50 text-white border-white/10 focus:border-brand-cyan/60 focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                      {...register('location')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl btn-gradient font-bold text-white transition-all cursor-pointer"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Publish Open Role
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
