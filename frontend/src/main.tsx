import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { LanguageProvider } from '@/hooks/ui/useLanguage'
import { AuthProvider } from '@/stores/AuthContext'
import { ThemeProvider } from '@/stores/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import '@/i18n'
import './index.css'

// One client for the whole app. Conservative defaults: no refetch on window
// focus (matches the app's existing fetch behavior) and a short stale window.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* LanguageProvider sits inside AuthProvider so it can read the
              current user via useAuth() and force English for staff roles. */}
          <LanguageProvider>
            <TooltipProvider>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>}>
                <App />
              </Suspense>
              <Toaster />
            </TooltipProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)