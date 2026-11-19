import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AtSign, ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { authApi, getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LinkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (email: string) => void;
}

/** Email linking uses the same six-cell OTP treatment as the login flow. */
export function LinkEmailDialog({ open, onOpenChange, onLinked }: LinkEmailDialogProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setOtp("");
      setResendSeconds(0);
    }
  }, [open]);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!resendSeconds) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function sendOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await authApi.requestEmailOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      toast.success("Verification code sent to your email");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send verification code"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await authApi.verifyEmailOtp(email, otp);
      onLinked(email);
      toast.success("Email linked successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Invalid verification code"));
    } finally {
      setLoading(false);
    }
  }

  const digits = otp.padEnd(6, " ").split("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-5 p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {step === "email" ? "Link email address" : "Verify your email"}
          </DialogTitle>
          <DialogDescription>
            {step === "email"
              ? "Add an email address to your account. You can only link it once."
              : "Enter the 6-digit code sent to your email address."}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void sendOtp(); }}>
            <div className="space-y-1.5">
              <label htmlFor="link-email" className="text-sm font-medium text-text">Email address</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input id="link-email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" autoFocus />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Sending code...</> : "Send verification code"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void verifyOtp(); }}>
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-variant px-3 py-2.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">{email}</span>
              <button type="button" onClick={() => setStep("email")} className="flex items-center gap-1 text-[11px] text-primary hover:underline"><ArrowLeft className="h-3 w-3" /> Change</button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text">One-time password</label>
              <div className="flex justify-center gap-1.5">
                {digits.map((digit, index) => (
                  <button key={index} type="button" onClick={() => otpInputRef.current?.focus()} className={cn("flex h-10 w-9 items-center justify-center rounded-lg border font-mono text-lg font-bold transition-colors", digit !== " " ? "border-primary bg-primary/5 text-text" : "border-border-subtle bg-surface text-text-tertiary")}>
                    {digit !== " " ? digit : ""}
                  </button>
                ))}
              </div>
              <input ref={otpInputRef} className="sr-only" type="tel" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Backspace" && !otp) event.preventDefault(); }} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Verifying...</> : <><CheckCircle className="mr-1.5 h-4 w-4" />Verify & link email</>}
            </Button>
            <button type="button" disabled={loading || resendSeconds > 0} onClick={() => void sendOtp()} className="block w-full text-center text-sm font-medium text-primary disabled:cursor-not-allowed disabled:text-text-tertiary hover:underline">
              {resendSeconds ? `Resend in ${resendSeconds}s` : "Resend code"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
