import { useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { useAuth } from "@/context/AuthContext";

import {
  Home,
  MessageSquarePlus,
  ListChecks,
  User,
  Wallet,
  LogOut,
  FilePenLine,
} from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

import { SignOutDialog } from "@/components/SignOutDialog";

import { useQuestionDraft } from "@/hooks/useQuestionDraft";

const navItems = [
  { to: "/home", labelKey: "nav.home", icon: Home, end: true },
  { to: "/home/ask", labelKey: "nav.submit", icon: MessageSquarePlus },
  { to: "/home/questions", labelKey: "nav.submissions", icon: ListChecks },
  { to: "/home/wallet", labelKey: "nav.wallet", icon: Wallet },
  { to: "/home/profile", labelKey: "nav.profile", icon: User },
];

export function PublicSidebar() {
  const { pathname } = useLocation()
  const { t } = useTranslation();
  const { user } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const { hasDraft } = useQuestionDraft()

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border-subtle bg-white dark:border-border-subtle dark:bg-surface">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-subtle px-4 dark:border-border-subtle">
        <div className="flex h-9 w-9 items-center justify-center">
          <BrandLogo className="h-9 w-9" />
        </div>

        <div>
          <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">
            AnnaDatha
          </p>
          <p className="text-[11px] leading-tight text-text-tertiary">
            Public Portal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, labelKey, icon: Icon, end }) => {
  const isSubmitTab = to === '/home/ask'
  const isOnSubmitPage =
    pathname === '/home/ask' || pathname.startsWith('/home/ask/')

  return (
    <NavLink
      key={to}
      to={to}
      end={end}
      tabIndex={to === '/home/wallet' ? -1 : 0}
      onClick={(e) => {
        if (to === '/home/wallet') e.preventDefault()
      }}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-text-secondary hover:bg-surface-variant hover:text-foreground',
          to === '/home/wallet' && 'pointer-events-none opacity-50'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />

      <span className="flex-1 flex items-center justify-between">
        <span>{t(labelKey)}</span>
        {to === '/home/wallet' && (
          <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">
            {t('common.comingSoon', 'Coming Soon')}
          </span>
        )}
      </span>

      {isSubmitTab && hasDraft && !isOnSubmitPage && (
        <FilePenLine
          aria-label={t('nav.draftQuestion', {
            defaultValue: 'Draft question',
          })}
          className="h-4 w-4 shrink-0 text-orange-500"
        />
      )}
    </NavLink>
  )
})}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-border-subtle p-3 dark:border-border-subtle">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-variant px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground sm:text-xs">
            {(user?.name || user?.mobileNumber || "?")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-foreground sm:text-xs">
              {user?.name || "Welcome"}
            </p>

            <p className="truncate text-[11px] text-text-tertiary">
              {user?.mobileNumber}
            </p>
          </div>
        </div>

        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 sm:text-sm"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("profile.signOut")}
        </button>
      </div>

      <SignOutDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
      />
    </aside>
  );
}
