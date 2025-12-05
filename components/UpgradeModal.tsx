'use client';

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeButton } from "@/components/UpgradeButton";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hiddenMatchCount: number;
  email: string;
  onDismiss?: () => void;
  customTitle?: string;
}

const freeFeatures = [
  "1 startup match",
  "View match details",
  "Basic profile access",
];

const premiumFeatures = [
  "Unlimited startup matches",
  "AI-powered resume tailoring",
  "Personalized cold DM generation",
  "Automated email outreach",
  "Priority support",
];

export function UpgradeModal({ open, onOpenChange, hiddenMatchCount, email, onDismiss, customTitle }: UpgradeModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          onDismiss?.();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className={cn(
          "fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 bg-black border border-white/20 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-3xl text-white"
        )}>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none text-white hover:text-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <DialogPrimitive.Title className="text-2xl font-bold text-white">
                {customTitle || `🔒 ${hiddenMatchCount} More Match${hiddenMatchCount === 1 ? '' : 'es'} Available`}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-white/60 text-sm mt-2">
                Upgrade to Premium to unlock all your matches and premium features
              </DialogPrimitive.Description>
            </div>

            {/* Two Card Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Free Plan Card */}
              <div className="border border-white/20 rounded-xl p-4 flex flex-col bg-white/5">
                <div className="text-center mt-3">
                  <h3 className="text-xl font-bold text-white mb-1">Free</h3>
                  <p className="text-white/60 text-xs mb-3">Access to basic matching features</p>
                  <div className="text-2xl font-bold text-white mb-1">$0</div>
                  <div className="text-white/60 text-xs mb-4">USD / month</div>
                </div>
                <div className="flex-1 space-y-2 mb-4">
                  {freeFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 min-h-[20px]">
                      <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white/60" />
                      </div>
                      <span className="text-white/80 text-xs">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onOpenChange(false);
                      onDismiss?.();
                    }}
                    className="w-full py-2.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium text-center hover:bg-green-500/30 transition-colors"
                  >
                    Continue with Free
                  </Button>
                </div>
              </div>

              {/* Premium Plan Card */}
              <div className="border-2 border-blue-500 rounded-xl p-4 flex flex-col relative bg-gradient-to-br from-blue-900/30 to-indigo-900/30">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Best for students ✨
                  </div>
                </div>
                <div className="text-center mt-3">
                  <h3 className="text-xl font-bold text-white mb-1">Premium</h3>
                  <p className="text-white/60 text-xs mb-3">Unlock all features and unlimited matches</p>
                  <div className="text-2xl font-bold text-white mb-1">$15</div>
                  <div className="text-white/60 text-xs mb-4">USD / month</div>
                </div>
                <div className="flex-1 space-y-2 mb-4">
                  {premiumFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 min-h-[20px]">
                      <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-white/80 text-xs">{feature}</span>
                    </div>
                  ))}
                </div>
                <UpgradeButton email={email} className="w-full text-sm py-2.5 mt-auto" />
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

