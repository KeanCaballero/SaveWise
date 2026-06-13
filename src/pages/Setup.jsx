import { Navigate, useNavigate } from 'react-router-dom'
import { Database, FlaskConical, ExternalLink } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { enterDemoMode, isDemoMode } from '@/services/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const STEPS = [
  <>Create a free project at <span className="font-semibold">supabase.com</span></>,
  <>Open the <span className="font-semibold">SQL Editor</span> and run <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">supabase/schema.sql</code> from this repo</>,
  <>Copy your Project URL and anon key from <span className="font-semibold">Project Settings → API</span></>,
  <>Add them to <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">.env</code> as <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code> and <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>, then restart the dev server</>,
]

export default function Setup() {
  const navigate = useNavigate()
  if (isSupabaseConfigured() || isDemoMode()) return <Navigate to="/profiles" replace />

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-3xl font-extrabold text-primary-foreground shadow-lift">S</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome to SaveWise</h1>
          <p className="mt-1 font-medium text-muted-foreground">Track. Save. Grow.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> Connect Supabase
            </CardTitle>
            <CardDescription>SaveWise stores your data in your own free Supabase project. One-time setup:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <Button variant="outline" className="w-full" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                Open Supabase dashboard <ExternalLink />
              </a>
            </Button>

            <Alert variant="info">
              <FlaskConical />
              <AlertTitle>Just want a look around?</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>Demo Mode runs SaveWise entirely in this browser with sample data — no account or setup needed.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    enterDemoMode()
                    navigate('/profiles')
                  }}
                >
                  Enter Demo Mode
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
