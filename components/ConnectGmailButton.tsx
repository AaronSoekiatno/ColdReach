"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface ConnectGmailButtonProps {
  onConnected?: () => void;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export const ConnectGmailButton = ({ 
  onConnected, 
  variant = "default",
  className 
}: ConnectGmailButtonProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsChecking(false);
          return;
        }

        const response = await fetch('/api/auth/gmail/status', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setIsConnected(data.connected && !data.expired);
        }
      } catch (error) {
        console.error('Failed to check Gmail connection:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkConnection();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkConnection();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleConnectGmail = async () => {
    try {
      setIsConnecting(true);
      
      // Redirect to Gmail OAuth
      window.location.href = '/api/auth/gmail/connect';
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect Gmail. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  if (isChecking) {
    return (
      <Button
        disabled
        variant={variant}
        className={className}
      >
        Checking...
      </Button>
    );
  }

  if (isConnected) {
    return (
      <Button
        disabled
        variant={variant}
        className={className}
      >
        ✓ Gmail Connected
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnectGmail}
      disabled={isConnecting}
      variant={variant}
      className={className}
    >
      {isConnecting ? "Connecting..." : "Connect Gmail"}
    </Button>
  );
};

