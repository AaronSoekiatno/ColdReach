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

    // Check for Gmail connection success in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail_connected') === 'true') {
      setTimeout(() => {
        checkConnection();
        if (onConnected) {
          onConnected();
        }
      }, 500);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [onConnected]);

  const handleConnectGmail = async () => {
    try {
      setIsConnecting(true);
      
      // Get session with access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.user) {
        toast({
          title: "Please sign in",
          description: "You need to be signed in to connect Gmail.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }
      
      if (!session.access_token) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }
      
      // Pass access token as query parameter (server will validate it)
      window.location.href = `/api/auth/gmail/connect?token=${encodeURIComponent(session.access_token)}`;
    } catch (error) {
      console.error('Connect Gmail error:', error);
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

