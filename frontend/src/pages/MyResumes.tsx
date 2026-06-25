import React, { useState } from 'react';
import { useMyResumes, useDeleteResume } from '../hooks/useResumes';
import { Link } from 'react-router-dom';
import { FileText, Calendar, Trash2, Eye, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
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

export const MyResumes: React.FC = () => {
  const { data: resumes, isLoading, error } = useMyResumes();
  const deleteMutation = useDeleteResume();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (resumeId: number) => {
    if (confirm('Are you sure you want to delete this resume? This action cannot be undone.')) {
      setDeletingId(resumeId);
      try {
        await deleteMutation.mutateAsync(resumeId);
      } catch (err) {
        console.error('Delete failed', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-40 border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">My Resumes</h1>
          <p className="text-slate-400 mt-1">
            Manage your uploaded resumes and evaluate them against open positions
          </p>
        </div>
        <Link
          to="/upload"
          className="flex items-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg cursor-pointer hover:-translate-y-0.5 transition-all"
        >
          <Plus className="h-4 w-4" />
          Upload New
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Failed to load resumes. Please try again later.</span>
        </div>
      )}

      {resumes?.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-white/5 bg-slate-900/40 backdrop-blur-md rounded-2xl p-16 text-center space-y-4">
          <div className="h-14 w-14 bg-slate-950 border border-white/10 text-slate-400 rounded-full flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">No Resumes Yet</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">
              Upload your first resume in PDF format to get started with AI skill extraction and scoring.
            </p>
          </div>
          <Link
            to="/upload"
            className="flex items-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Upload First Resume
          </Link>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resumes?.map((resume) => (
            <motion.div
              layout
              variants={itemVariants}
              key={resume.resume_id}
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-10 w-10 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 truncate" title={resume.filename}>
                    {resume.filename}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(resume.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-5 mt-5 border-t border-white/5">
                <Link
                  to={`/resumes/${resume.resume_id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-950/50 hover:bg-brand-cyan/10 border border-white/5 hover:border-brand-cyan/20 text-slate-300 hover:text-brand-cyan text-xs font-semibold transition-all"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View & Score
                </Link>
                <button
                  onClick={() => handleDelete(resume.resume_id)}
                  disabled={deletingId === resume.resume_id}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  title="Delete Resume"
                >
                  {deletingId === resume.resume_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
