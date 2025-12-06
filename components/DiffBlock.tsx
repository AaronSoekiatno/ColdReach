"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiffBlockProps {
  suggestion: {
    id: string;
    section: string;
    original: string;
    suggested: string;
    reason: string;
    keywords: string[];
  };
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
}

export function DiffBlock({ suggestion, status, onAccept, onReject }: DiffBlockProps) {
  return (
    <div className={`border rounded-lg mb-3 overflow-hidden transition-all ${
      status === 'accepted' ? 'border-green-500/50 bg-green-500/5' :
      status === 'rejected' ? 'border-red-500/30 bg-red-500/5 opacity-50' :
      'border-white/10'
    }`}>
      {/* Header */}
      <div className="bg-white/5 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-white/70 font-medium">{suggestion.section}</span>
        {status === 'pending' && (
          <div className="flex gap-1">
            <Button
              onClick={onAccept}
              size="sm"
              className="h-7 px-2 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30"
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              onClick={onReject}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
        {status === 'accepted' && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3 w-3" />
            Accepted
          </div>
        )}
        {status === 'rejected' && (
          <div className="flex items-center gap-1 text-xs text-red-400/70">
            <X className="h-3 w-3" />
            Rejected
          </div>
        )}
      </div>

      {/* Diff Content */}
      <div className="p-3 font-mono text-xs space-y-2">
        {/* Original (removed) */}
        <div className="bg-red-500/10 text-red-300 px-3 py-2 rounded border-l-2 border-red-500/50">
          <span className="text-red-400 mr-2">-</span>
          {suggestion.original}
        </div>

        {/* Suggested (added) */}
        <div className="bg-green-500/10 text-green-300 px-3 py-2 rounded border-l-2 border-green-500/50">
          <span className="text-green-400 mr-2">+</span>
          {suggestion.suggested}
        </div>
      </div>

      {/* Reason */}
      <div className="bg-blue-500/10 px-3 py-2 border-t border-white/10">
        <div className="flex items-start gap-2">
          <span className="text-blue-400 text-xs mt-0.5">💡</span>
          <div className="flex-1">
            <p className="text-xs text-blue-300">{suggestion.reason}</p>
            {suggestion.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestion.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-200 rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
