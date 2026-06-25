import React, { useState, useRef } from 'react';
import { useUploadResume } from '../hooks/useResumes';
import { useJobs } from '../hooks/useJobs';
import { FileUp, FileText, CheckCircle, AlertTriangle, Loader2, Award, Terminal, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

export const UploadResume: React.FC = () => {
  const uploadMutation = useUploadResume();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedJobId) {
      setError('Please select a job application target first.');
      return;
    }
    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF resumes are supported.');
      return;
    }
    setFile(selectedFile);
    
    uploadMutation.mutate({ file: selectedFile, jobId: parseInt(selectedJobId) }, {
      onError: (err: any) => {
        setError(err.response?.data?.detail || 'Resume upload and extraction failed.');
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setError(null);
    uploadMutation.reset();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
          AI Skill Parser
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Upload your resume in PDF format. Our neural engine will parse skills and compile competency clusters
        </p>
      </div>

      <div className="glass-card rounded-3xl p-6 space-y-6">
        
        {!file && (
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-300">Target Role Application <span className="text-red-400">*</span></label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-cyan focus:border-transparent outline-none transition-all"
              disabled={jobsLoading}
            >
              <option value="" disabled>Select a career opportunity...</option>
              {jobs?.map(job => (
                <option key={job.id} value={job.id}>{job.title} {job.company ? `— ${job.company.name}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {!file ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
              !selectedJobId ? 'opacity-50 cursor-not-allowed border-white/5' : 'cursor-pointer ' + (dragActive
                ? 'border-brand-cyan bg-brand-cyan/10 shadow-[0_0_20px_rgba(0,229,255,0.05)]'
                : 'border-white/10 hover:bg-slate-950/20 hover:border-brand-cyan/20')
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleChange}
              disabled={!selectedJobId}
            />
            <div className="h-14 w-14 bg-slate-950 border border-white/5 text-brand-cyan rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,229,255,0.1)]">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-slate-200 font-bold text-lg">
              Drag & Drop your resume here
            </p>
            <p className="text-slate-450 text-sm mt-1">or click to browse files</p>
            <span className="inline-block mt-4 text-[10px] font-bold px-2.5 py-1 bg-white/5 rounded-full text-slate-400 border border-white/10 uppercase tracking-widest">
              PDF only (Max 10MB)
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/50 border border-white/5">
              <div className="h-10 w-10 bg-brand-purple/20 text-brand-purple border border-brand-purple/30 rounded-lg flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-200 truncate">{file.name}</h4>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              
              <div className="flex items-center gap-3">
                {uploadMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-cyan" />
                    Extracting competency blocks...
                  </div>
                )}
                {uploadMutation.isSuccess && (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Extracted
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-sm text-red-400 flex gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <h5 className="font-bold">Extraction Fault</h5>
                  <p className="mt-0.5">{error}</p>
                  <button onClick={resetUpload} className="mt-2 text-xs font-bold underline cursor-pointer">
                    Retry Upload
                  </button>
                </div>
              </div>
            )}

            {uploadMutation.isSuccess && uploadMutation.data && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pt-2 border-t border-white/5"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Extracted Plaintext Snippet</h3>
                  <div className="mt-2 p-4 rounded-2xl bg-slate-950/50 border border-white/5 text-xs font-mono text-slate-400 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {uploadMutation.data.extracted_text}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider">AI Competency Mapping</h3>
                  {uploadMutation.data.extracted_skills?.error && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-400">
                      Extraction error details: {uploadMutation.data.extracted_skills.error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Technical Skills */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
                      <div className="flex items-center gap-2 text-slate-405">
                        <Cpu className="h-4.5 w-4.5 text-brand-cyan" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Technical Skills</h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {uploadMutation.data.extracted_skills?.technical_skills?.length ? (
                          uploadMutation.data.extracted_skills.technical_skills.map((skill, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded bg-white/5 border border-white/5 text-slate-300 font-medium">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">None extracted</span>
                        )}
                      </div>
                    </div>

                    {/* Tools and Technologies */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
                      <div className="flex items-center gap-2 text-slate-405">
                        <Terminal className="h-4.5 w-4.5 text-brand-purple" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Tools & Stack</h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {uploadMutation.data.extracted_skills?.tools_and_technologies?.length ? (
                          uploadMutation.data.extracted_skills.tools_and_technologies.map((tool, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded bg-white/5 border border-white/5 text-slate-300 font-medium">
                              {tool}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">None extracted</span>
                        )}
                      </div>
                    </div>

                    {/* Soft Skills */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
                      <div className="flex items-center gap-2 text-slate-405">
                        <Award className="h-4.5 w-4.5 text-emerald-400" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Soft Skills</h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {uploadMutation.data.extracted_skills?.soft_skills?.length ? (
                          uploadMutation.data.extracted_skills.soft_skills.map((skill, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded bg-white/5 border border-white/5 text-slate-300 font-medium">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">None extracted</span>
                        )}
                      </div>
                    </div>

                    {/* Certifications */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
                      <div className="flex items-center gap-2 text-slate-405">
                        <Award className="h-4.5 w-4.5 text-amber-400" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Certifications</h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {uploadMutation.data.extracted_skills?.certifications?.length ? (
                          uploadMutation.data.extracted_skills.certifications.map((cert, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded bg-white/5 border border-white/5 text-slate-300 font-medium">
                              {cert}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">None extracted</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={resetUpload}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Upload Another Resume
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
