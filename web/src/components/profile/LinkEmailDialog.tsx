import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AtSign, Loader2, Mail, ShieldCheck } from "lucide-react";
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

/** Two-step dialog that confirms an email address with a 6-digit code before linking it. */
export function LinkEmailDialog({ open, onOpenChange, onLinked }: LinkEmailDialogProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [otpFocused, setOtpFocused] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setEmailError("");
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
      setEmailError("Enter a valid email address, for example name@example.com.");
      return;
    }
    setEmailError("");

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
  const activeIndex = Math.min(otp.length, 5);
  const isEmailStep = step === "email";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void (isEmailStep ? sendOtp() : verifyOtp());
          }}
        >
          <div className="px-5 pb-6 pt-7 sm:px-6">
            <DialogHeader className="items-center space-y-1 text-center">
              <span
                aria-hidden="true"
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5 dark:text-emerald-300"
              >
                {isEmailStep ? <Mail className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Step {isEmailStep ? 1 : 2} of 2
              </p>
              <DialogTitle className="text-lg sm:text-xl">
                {isEmailStep ? "Link a backup email" : "Check your inbox"}
              </DialogTitle>
              <DialogDescription className="max-w-sm text-sm leading-relaxed">
                {isEmailStep ? (
                  "We will send a 6-digit code to confirm this address. Each account can link one email."
                ) : (
                  <>
                    Enter the 6-digit code sent to{" "}
                    <span className="break-all font-medium text-text">{email}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {isEmailStep ? (
              <div className="mt-6 space-y-1.5">
                <label htmlFor="link-email" className="text-sm font-medium text-text">
                  Email address
                </label>
                <div className="relative">
                  <AtSign aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    id="link-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (emailError) setEmailError("");
                    }}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "link-email-error" : undefined}
                    className={cn("h-11 pl-9", emailError && "border-destructive focus-visible:ring-destructive")}
                    autoFocus
                  />
                </div>
                {emailError && (
                  <p id="link-email-error" role="alert" className="text-xs text-destructive">
                    {emailError}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <label htmlFor="link-email-otp" className="sr-only">
                  Verification code
                </label>
                <div className="flex justify-center gap-2" onClick={() => otpInputRef.current?.focus()}>
                  {digits.map((digit, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={cn(
                        "flex h-12 w-10 items-center justify-center rounded-lg border bg-surface font-mono text-xl font-semibold text-text transition-colors sm:w-11",
                        digit !== " " ? "border-primary/60" : "border-border-subtle",
                        otpFocused && index === activeIndex && "border-primary ring-2 ring-primary/20",
                      )}
                    >
                      {digit !== " " ? digit : ""}
                    </span>
                  ))}
                </div>
                <input
                  id="link-email-otp"
                  ref={otpInputRef}
                  className="sr-only"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onFocus={() => setOtpFocused(true)}
                  onBlur={() => setOtpFocused(false)}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Backspace" && !otp) event.preventDefault();
                  }}
                />
                <p className="text-center text-xs text-text-secondary">
                  Did not get it?{" "}
                  <button
                    type="button"
                    disabled={loading || resendSeconds > 0}
                    onClick={() => void sendOtp()}
                    className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-text-tertiary disabled:no-underline dark:text-emerald-300"
                  >
                    {resendSeconds ? `Resend in ${resendSeconds}s` : "Resend code"}
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-variant/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={loading}
              onClick={() => (isEmailStep ? onOpenChange(false) : setStep("email"))}
            >
              {isEmailStep ? "Cancel" : "Change email"}
            </Button>
            <Button type="submit" className="h-10 min-w-36" disabled={loading || (!isEmailStep && otp.length !== 6)}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isEmailStep ? (loading ? "Sending code" : "Send code") : loading ? "Verifying" : "Verify and link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
