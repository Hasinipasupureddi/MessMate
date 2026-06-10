'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

const complaintCategories = ['Quality', 'Hygiene', 'Quantity', 'Service', 'Other'] as const;

export default function ComplaintBox() {
  const [selectedCategory, setSelectedCategory] = useState<(typeof complaintCategories)[number]>('Quality');
  const [complaintText, setComplaintText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedLength = useMemo(() => complaintText.trim().length, [complaintText]);
  const canSubmit = useMemo(() => trimmedLength >= 10, [trimmedLength]);

  const handleSubmit = async () => {
    const trimmed = complaintText.trim();

    if (trimmed.length < 10) {
      toast.error('Please enter at least 10 characters for your complaint.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          complaintText: trimmed,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.message || 'Unable to submit complaint right now. Please try again.');
        return;
      }

      toast.success('Complaint submitted successfully. We will look into it soon.');
      setComplaintText('');
      setSelectedCategory('Quality');
    } catch {
      toast.error('Unable to submit complaint right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Complaint Box</h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Raise hygiene or meal quality issues quickly
          </p>
        </div>

        <div className="w-9 h-9 rounded-xl border border-rose-400/40 bg-rose-500/10 flex items-center justify-center text-rose-300">
          <AlertCircle className="w-4 h-4" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {complaintCategories.map(category => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              selectedCategory === category
                ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <textarea
        value={complaintText}
        onChange={e => setComplaintText(e.target.value)}
        placeholder="Write your complaint details..."
        rows={4}
        className="input-glass resize-none min-h-[112px] sm:min-h-[124px]"
      />

      <div className="flex items-center justify-between text-xs">
        <p className={`${canSubmit ? 'text-emerald-400' : 'text-[hsl(var(--muted-foreground))]'}`}>
          {canSubmit ? 'Looks good to submit' : 'Write at least 10 characters to submit'}
        </p>
        <span className={`${canSubmit ? 'text-emerald-400' : 'text-[hsl(var(--muted-foreground))]'} font-mono`}>
          {trimmedLength}/10
        </span>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-11 rounded-xl font-semibold text-sm text-white gradient-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-1.5"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
        {!isSubmitting && <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}