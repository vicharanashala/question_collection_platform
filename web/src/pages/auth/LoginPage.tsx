import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ANVESHAN_PLATFORM_URL, ANVESHAN_TAGLINE } from "@/constants/public";
import { motion, AnimatePresence } from "framer-motion";
import { authApi, getErrorMessage, setRegistrationToken } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  Smartphone,
  MicVocal,
  Languages,
  Wallet,
  BookOpen,
  Sun,
  Moon,
  Sprout,
  Camera,
  Award,
  Mail,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LegalDocumentModal } from "@/components/ui/legal-document-modal";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';

// ─── Resend countdown ──────────────────────────────────────────────────────

const RESEND_COOLDOWN = 30;

function useCountdown(initial = 0) {
  const [secs, setSecs] = useState(initial);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = (from = RESEND_COOLDOWN) => {
    setSecs(from);
    setActive(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActive(false);
    setSecs(0);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  return { secs, active, start, stop };
}

// ─── Decorative orb ────────────────────────────────────────────────────────

function Orb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute rounded-full bg-[hsl(var(--primary))]/10 blur-3xl pointer-events-none",
        className,
      )}
    />
  );
}

// ─── Branding panel features ───────────────────────────────────────────────

const LANGUAGES_FEATURE = {
  icon: Languages,
  heading: "22 Indian Languages",
  body: "Full support for Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu, and more.",
};

const FEATURES = [
  {
    icon: MicVocal,
    heading: "Voice & Text Questions",
    body: "Ask in your own language — Hindi, Tamil, Telugu, and 19 more Indian languages.",
  },
  {
    icon: Wallet,
    heading: "Earn Rewards",
    body: "Get points for every approved question. Withdraw earnings via UPI or bank.",
  },
  {
    icon: BookOpen,
    heading: "Expert Answers",
    body: "Curated FAQ knowledge base built by agricultural experts and community moderators.",
  },
  LANGUAGES_FEATURE,
];

// Shown instead of FEATURES when the page is opened with ?isAnveshan=true.
const ANVESHAN_FEATURES = [
  {
    icon: MicVocal,
    heading: "Voice & Text Questions",
    body: "Record the questions farmers raise during your visit, by voice or text, in their own language.",
  },
  {
    icon: Sprout,
    heading: "Crop, Weed, Pest & Disease Records",
    body: "Document local names alongside English and botanical names, with links to supporting sources.",
  },
  {
    icon: Camera,
    heading: "Field Photos",
    body: "Capture photos directly in the field during your visit to support every record you submit.",
  },
  {
    icon: Award,
    heading: "Track Your Milestone",
    body: "Follow your progress towards the Anveshan milestone as you submit questions and records.",
  },
  LANGUAGES_FEATURE,
];

// ─── Step 1: Mobile number ─────────────────────────────────────────────────

function StepMobile({
  mobile,
  setMobile,
  loading,
  onSubmit,
}: {
  mobile: string;
  setMobile: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs sm:text-sm font-medium text-[hsl(var(--text))]">{t('loginPhone.mobileNumber')}</label>
        <div className="flex gap-1.5 sm:gap-2">
          <div className="flex items-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-variant))] px-3 sm:px-4 text-sm font-semibold text-[hsl(var(--text-secondary))]">
            +91
          </div>
          <Input
            type="tel"
            inputMode="tel"
            placeholder={t('loginPage.10DigitNumber')}
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className="flex-1 text-sm sm:text-base font-medium"
            maxLength={10}
            autoComplete="tel"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending OTP...
          </>
        ) : (
          "Send OTP"
        )}
      </Button>

      <p className="text-center text-[11px] sm:text-xs text-[hsl(var(--text-tertiary))]">{t('loginPage.digitCodeWillBe')}</p>
    </form>
  );
}

// ─── Step 2: OTP ───────────────────────────────────────────────────────────

function StepOtp({
  identifier,
  method,
  otp,
  setOtp,
  loading,
  countdown,
  onSubmit,
  onBack,
  onResend,
  onUseEmail,
}: {
  identifier: string;
  method: "phone" | "email";
  otp: string;
  setOtp: (v: string) => void;
  loading: boolean;
  countdown: ReturnType<typeof useCountdown>;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  onResend: () => void;
  onUseEmail?: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && otp[idx] === "" && idx > 0) {
      // Move focus to previous box when backspacing an empty box
      const prev = inputRef.current?.parentElement?.children[idx - 1] as
        | HTMLInputElement
        | undefined;
      prev?.focus();
    }
  };

  const digits = otp.padEnd(6, " ").split("");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Delivery address badge */}
      <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-variant))] px-3 py-2.5">
        {method === "phone" ? <Smartphone className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" /> : <Mail className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[hsl(var(--text))]">
          {method === "phone" ? `+91 ${identifier}` : identifier}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-[hsl(var(--primary))] hover:underline shrink-0"
        >
          <ArrowLeft className="h-3 w-3" /> {t('loginPage.change')}
        </button>
      </div>

      {/* OTP boxes */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[hsl(var(--text))]">{t('loginPage.oneTimePassword')}</label>
        <div className="flex gap-1.5 justify-center">
          {digits.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => inputRef.current?.focus()}
              className={cn(
                "flex h-10 w-9 items-center justify-center rounded-lg border text-lg font-bold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-1",
                d && d !== " "
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--text))]"
                  : "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))]",
              )}
            >
              {d && d !== " " ? d : ""}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          name="otp"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(e) => {
            const idx = otp.length;
            handleKeyDown(e as unknown as KeyboardEvent<HTMLInputElement>, idx);
          }}
          autoComplete="one-time-code"
          className="sr-only"
          maxLength={6}
        />
        <p className="text-[11px] text-[hsl(var(--text-tertiary))] text-center">
          {method === "email" ? "Enter the 6-digit code sent to your email" : t('loginPage.enterTheDigitCode')}
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={loading || otp.length < 6}
      >
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Verifying...
          </>
        ) : (
          <>
            <CheckCircle className="mr-1.5 h-4 w-4" /> Verify & Sign In
          </>
        )}
      </Button>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onResend}
          disabled={countdown.active || loading}
          className={cn(
            "text-xs sm:text-sm font-medium transition-colors",
            countdown.active
              ? "text-[hsl(var(--text-tertiary))] cursor-not-allowed"
              : "text-[hsl(var(--primary))] hover:underline",
          )}
        >
          {countdown.active
            ? `Resend in ${countdown.secs}s`
            : t('loginPage.didnReceiveItResend')}
        </button>
      </div>

      {/* SMS can be accepted by the gateway and still never arrive, so the email code is always offered. */}
      {onUseEmail && (
        <div className="flex items-center justify-center border-t border-[hsl(var(--border-subtle))] pt-3">
          <button
            type="button"
            onClick={onUseEmail}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:underline disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Get the code by email instead
          </button>
        </div>
      )}
    </form>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

// Mobile OTP failures that an email OTP can work around: SMS delivery that failed
// or timed out, and the per-number OTP request limit.
const EMAIL_FALLBACK_ERROR_CODES = new Set(["OTP_DELIVERY_FAILED", "OTP_RATE_LIMITED"]);
const EMAIL_FALLBACK_STATUSES = new Set([408, 429]);

// Returns true when the email login fallback is worth offering for an OTP request error.
function canUseEmailFallback(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { status, data } = err as { status?: number; data?: { code?: string } };
  return (
    (status !== undefined && EMAIL_FALLBACK_STATUSES.has(status)) ||
    (data?.code !== undefined && EMAIL_FALLBACK_ERROR_CODES.has(data.code))
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAnveshanLogin = searchParams.get("isAnveshan") === "true";
  const brandFeatures = isAnveshanLogin ? ANVESHAN_FEATURES : FEATURES;
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState<1 | 2>(1);
  const [otpDelivery, setOtpDelivery] = useState<"phone" | "email">("phone");
  const location = useLocation();
  // "Check again" on the Anveshan phase gate returns here with the number filled in.
  const prefilledMobile = (location.state as { mobileNumber?: string } | null)?.mobileNumber ?? "";
  const [mobile, setMobile] = useState(prefilledMobile);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFallbackOpen, setEmailFallbackOpen] = useState(false);
  const [emailFallbackLoading, setEmailFallbackLoading] = useState(false);
  // Masked address from the server, shown on the code screen.
  const [linkedEmail, setLinkedEmail] = useState("");
  const [emailFallbackError, setEmailFallbackError] = useState("");
  // Masked address the dialog offers to send the code to, looked up when it opens.
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [fallbackEmailLoading, setFallbackEmailLoading] = useState(false);
  // Anveshan candidate whose email is only used after the Ground Truth Module.
  const [anveshanPhasePending, setAnveshanPhasePending] = useState(false);
  const sendEmailCodeRef = useRef<HTMLButtonElement>(null);
  const countdown = useCountdown();
  const [legalDoc, setLegalDoc] = useState<"terms" | "privacy" | null>(null);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const cleaned = mobile.replace(/\D/g, "").slice(0, 10);
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error(t('loginPage.mobileNumberMustBe'));
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestOtp(cleaned, false);
      if (res.otp) console.log(`[OTP] ${res.otp} for +91 ${cleaned}`);
      setOtpDelivery("phone");
      setStep(2);
      countdown.start();
      toast.success(t('loginPage.otpSentToYour'));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send OTP"));
      if (canUseEmailFallback(err)) setEmailFallbackOpen(true);
    } finally {
      setLoading(false);
    }
  }

  // Leaves the email option: tries the SMS again from the first screen, or returns to the
  // SMS code screen when a code was already sent.
  function handleContinueWithPhone() {
    setEmailFallbackOpen(false);
    setEmailFallbackError("");
    setAnveshanPhasePending(false);
    if (step === 1) void handleSendOtp();
  }

  // Shows why the email option is unavailable inside the dialog, or as a toast for other errors.
  function showEmailFallbackError(err: unknown, fallbackMessage: string) {
    const code = (err as { data?: { code?: string } })?.data?.code;
    if (code === "EMAIL_NOT_LINKED") {
      setEmailFallbackError(getErrorMessage(err, "No email is linked with this account."));
    } else if (code === "ANVESHAN_PHASE_PENDING") {
      setAnveshanPhasePending(true);
    } else {
      toast.error(getErrorMessage(err, fallbackMessage));
    }
  }

  // Looks up the masked linked email each time the dialog opens, before any code is sent.
  useEffect(() => {
    if (!emailFallbackOpen) return;
    let cancelled = false;
    setFallbackEmail("");
    setEmailFallbackError("");
    setAnveshanPhasePending(false);
    setFallbackEmailLoading(true);
    authApi
      .previewEmailLoginFallback(mobile)
      .then(({ maskedEmail }) => {
        if (!cancelled) setFallbackEmail(maskedEmail);
      })
      .catch((err: unknown) => {
        if (!cancelled) showEmailFallbackError(err, "Unable to check the linked email");
      })
      .finally(() => {
        if (!cancelled) setFallbackEmailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs only when the dialog opens; the number cannot change while it is open.
  }, [emailFallbackOpen]);

  async function handleEmailFallback() {
    setEmailFallbackLoading(true);
    setEmailFallbackError("");
    setAnveshanPhasePending(false);
    try {
      const { maskedEmail } = await authApi.requestEmailLoginFallback(mobile);
      setLinkedEmail(maskedEmail ?? "your linked email");
      setEmailFallbackOpen(false);
      setOtpDelivery("email");
      setOtp("");
      setStep(2);
      countdown.start();
      toast.success(`OTP sent to ${maskedEmail ?? "your linked email"}`);
    } catch (err) {
      showEmailFallbackError(err, "Unable to send an email OTP");
    } finally {
      setEmailFallbackLoading(false);
    }
  }

  // async function handleVerifyOtp(e: React.FormEvent) {
  //   e.preventDefault();
  //   const cleaned = otp.replace(/\D/g, "").slice(0, 6);
  //   if (cleaned.length !== 6) {
  //     toast.error("Enter the 6-digit OTP");
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     const res = await authApi.verifyOtp(mobile, cleaned);

  //     if ("requiresRegistration" in res && res.requiresRegistration) {
  //       if (res.role === "user") {
  //         navigate("/home", { state: { mobileNumber: mobile }, replace: true });
  //       } else {
  //         toast.error(
  //           "Your account is not yet activated. Please contact your administrator.",
  //         );
  //       }
  //       return;
  //     }

  //     const tokens = res.tokens!;
  //     const user = res.user!;
  //     login(
  //       { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  //       { ...user, token: tokens.accessToken },
  //     );

  //     if (user.role === "user") {
  //       toast.success("Welcome back!");
  //       navigate("/home", { replace: true });
  //     } else {
  //       toast.success("Welcome back!");
  //       navigate("/dashboard", { replace: true });
  //     }
  //   } catch (err) {
  //     toast.error(getErrorMessage(err, "Invalid OTP"));
  //     setOtp("");
  //   } finally {
  //     setLoading(false);
  //   }
  // }


  async function handleVerifyOtp(e: React.FormEvent) {
  e.preventDefault();
  const cleaned = otp.replace(/\D/g, "").slice(0, 6);
  if (cleaned.length !== 6) {
    toast.error(t('loginPage.enterTheDigitOtp'));
    return;
  }
  setLoading(true);
  try {
    // An email OTP from the fallback signs in through the same flow as an SMS OTP.
    const res =
      otpDelivery === "email"
        ? await authApi.verifyEmailLoginFallback(mobile, cleaned)
        : await authApi.verifyOtp(mobile, cleaned);

    if ("requiresRegistration" in res && res.requiresRegistration) {
      if (res.tempToken) {
        setRegistrationToken(res.tempToken);
      }
      if (res.anveshanPhaseInfo && !res.anveshanPhaseInfo.eligible) {
        navigate("/home/anveshan-phase-gate", {
          state: { ...res.anveshanPhaseInfo, mobileNumber: mobile, tempToken: res.tempToken },
          replace: true,
        });
        return;
      }
      if (res.role === "user") {
        navigate("/home", { state: { mobileNumber: mobile, tempToken: res.tempToken }, replace: true });
      } else {
        toast.error(
          t('loginPage.yourAccountIsNot'),
        );
      }
      return;
    }

    const tokens = res.tokens!;
    const user = res.user!;
    login(
      { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      { ...user, token: tokens.accessToken },
    );

    if (res.anveshanPhaseInfo && !res.anveshanPhaseInfo.eligible) {
      navigate("/home/anveshan-phase-gate", {
        state: { ...res.anveshanPhaseInfo, mobileNumber: mobile },
        replace: true,
      });
      return;
    }

    if (user.role === "user") {
      toast.success(t('loginPage.welcomeBack'));
      navigate("/home", { replace: true });
    } else {
      toast.success(t('loginPage.welcomeBack'));
      navigate("/dashboard", { replace: true });
    }
  } catch (err) {
    toast.error(getErrorMessage(err, "Invalid OTP"));
    setOtp("");
  } finally {
    setLoading(false);
  }
}

  async function handleResend() {
    if (countdown.active) return;
    setOtp("");
    setLoading(true);
    try {
      if (otpDelivery === "email") {
        const { maskedEmail } = await authApi.requestEmailLoginFallback(mobile);
        setLinkedEmail(maskedEmail ?? "your linked email");
      } else {
        const res = await authApi.requestOtp(mobile, false);
        if (res.otp) console.log(`[OTP] ${res.otp} for +91 ${mobile}`);
      }
      countdown.start();
      toast.success(t('loginPage.newOtpSent'));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep(1);
    setOtp("");
    setOtpDelivery("phone");
    countdown.stop();
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      {/* ── Theme toggle — fixed top right of the entire page ─────────── */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--surface-variant))] hover:text-[hsl(var(--text))]"
      >
        {theme === "light" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>

      {/* ── Left branding panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex relative flex-col justify-between shrink-0 w-[46%] max-w-[480px] overflow-hidden bg-[hsl(var(--primary))] px-10 py-12 xl:px-14">
        {/* Top: logo + brand name */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 p-2">
            <BrandLogo className="h-full w-full" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">{t('app.name')}</h1>
            <p className="text-white/60 text-sm">{isAnveshanLogin ? ANVESHAN_TAGLINE : t('loginPage.farmingQuestionsPlatform')}</p>
          </div>
        </div>

        {/* Centre: 4 feature bullets, clean and well-spaced */}
        <div className="flex flex-col justify-center flex-1 py-10">
          <ul className="space-y-6">
            {brandFeatures.map(({ icon: Icon, heading, body }) => (
              <li key={heading} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {heading}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55 leading-relaxed">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: simple footer */}
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} {isAnveshanLogin ? t('anveshanCompletionScreen.annadathaAnveshan') : t('app.name')}
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 relative overflow-hidden">
        {/* Background gradient orbs — mobile only */}
        <Orb className="-right-20 -top-24 w-[340px] h-[340px] lg:hidden opacity-50" />
        <Orb className="-left-16 bottom-0 w-[260px] h-[260px] lg:hidden opacity-50" />

        <div className="relative z-10 w-full max-w-sm">
          {/* ── Mobile card ── */}
          <Card className="w-full overflow-hidden shadow-lg border border-[hsl(var(--border-subtle))]">
            {/* Card header — logo + title + tagline */}
            <div className="flex flex-col items-center px-6 pt-7 pb-5 bg-[hsl(var(--primary))]">
              <div className="mb-2.5 h-14 w-14 rounded-2xl bg-white/20 p-2 shadow-sm">
                <BrandLogo className="h-full w-full" />
              </div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">{t('app.name')}</h1>
              <p className="mt-0.5 text-xs text-white/70">
                {isAnveshanLogin ? ANVESHAN_TAGLINE : t('loginPage.farmingQuestionsPlatform')}
              </p>
            </div>

            {/* Card body — form */}
            <div className="px-6 py-5">
              {/* Step heading */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-[hsl(var(--text))]">
                  {step === 1 ? t('loginPage.signIn') : t('auth.verifyOtp')}
                </h2>
                <p className="mt-0.5 text-xs text-[hsl(var(--text-secondary))]">
                  {step === 1
                    ? t('loginPhone.signInDesc')
                    : `OTP sent to ${otpDelivery === "phone" ? `+91 ${mobile}` : linkedEmail}`}
                </p>
              </div>

              {/* Animated step forms */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                >
                  {step === 1 ? (
                    <StepMobile
                      mobile={mobile}
                      setMobile={setMobile}
                      loading={loading}
                      onSubmit={handleSendOtp}
                    />
                  ) : (
                    <StepOtp
                      identifier={otpDelivery === "phone" ? mobile : linkedEmail}
                      method={otpDelivery}
                      otp={otp}
                      setOtp={setOtp}
                      loading={loading}
                      countdown={countdown}
                      onSubmit={handleVerifyOtp}
                      onBack={handleBack}
                      onResend={handleResend}
                      onUseEmail={otpDelivery === "phone" ? () => setEmailFallbackOpen(true) : undefined}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Legal */}
              <p className="mt-4 text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                By continuing, you agree to our{" "}
                <button
                  type="button"
                  onClick={() => setLegalDoc("terms")}
                  className="underline hover:text-[hsl(var(--text-secondary))]"
                >{t('loginPage.terms')}</button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setLegalDoc("privacy")}
                  className="underline hover:text-[hsl(var(--text-secondary))]"
                >{t('profile.privacyPolicy')}</button>
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Legal document modals */}
      <LegalDocumentModal
        type={legalDoc ?? "terms"}
        open={legalDoc !== null}
        onOpenChange={(open) => !open && setLegalDoc(null)}
      />

      <Dialog
        open={emailFallbackOpen}
        onOpenChange={(open) => {
          setEmailFallbackOpen(open);
          if (!open) {
            setEmailFallbackError("");
            setAnveshanPhasePending(false);
          }
        }}
      >
        <DialogContent
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
          // Focus the main action, so Enter sends the email code.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            sendEmailCodeRef.current?.focus();
          }}
        >
          <div className="px-5 pb-6 pt-7 sm:px-6">
            <DialogHeader className="items-center space-y-1 text-center">
              <span
                aria-hidden="true"
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5 dark:text-emerald-300"
              >
                <Mail className="h-5 w-5" />
              </span>
              <DialogTitle className="text-lg sm:text-xl">Get your code by email</DialogTitle>
              <DialogDescription className="max-w-sm text-sm leading-relaxed">
                {step === 1
                  ? `We could not send an SMS to +91 ${mobile} right now. `
                  : "SMS not arriving? "}
                We can send the sign-in code to the email linked to this account instead.
              </DialogDescription>
            </DialogHeader>
            {fallbackEmailLoading && (
              <div
                role="status"
                className="mx-auto mt-5 flex h-11 max-w-xs items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-variant/40 text-sm text-text-secondary"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Checking linked email
              </div>
            )}
            {!fallbackEmailLoading && fallbackEmail && (
              <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 rounded-lg border border-border-subtle bg-surface-variant/40 px-3 py-2.5">
                <Mail className="h-4 w-4 shrink-0 text-primary dark:text-emerald-300" aria-hidden="true" />
                <div className="min-w-0 text-left">
                  <p className="text-xs text-text-tertiary">Code will be sent to</p>
                  <p className="truncate text-sm font-medium text-text">{fallbackEmail}</p>
                </div>
              </div>
            )}
            {emailFallbackError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{emailFallbackError} You can link one from your profile after you sign in.</span>
              </div>
            )}
            {anveshanPhasePending && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 text-sm text-text dark:border-emerald-400/30"
              >
                <div className="flex items-start gap-2">
                  <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-emerald-300" aria-hidden="true" />
                  <p className="leading-relaxed">
                    Your account needs to be in the <strong>{ANVESHAN_TAGLINE}</strong> on the Anveshan platform to
                    receive sign-in codes by email.
                  </p>
                </div>
                <a
                  href={ANVESHAN_PLATFORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-6 mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Go to Anveshan
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-variant/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="outline" className="h-10" onClick={handleContinueWithPhone} disabled={emailFallbackLoading}>
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Continue with phone
            </Button>
            <Button
              ref={sendEmailCodeRef}
              className="h-10 min-w-44"
              onClick={() => void handleEmailFallback()}
              disabled={
                emailFallbackLoading || fallbackEmailLoading || !fallbackEmail || !!emailFallbackError || anveshanPhasePending
              }
            >
              {emailFallbackLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="h-4 w-4" aria-hidden="true" />
              )}
              {emailFallbackLoading ? "Sending code" : "Send code to email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
