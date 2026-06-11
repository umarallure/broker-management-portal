import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { hasOnboardingPortalAccess } from '@/lib/portalAccess';

type HeroLine = {
  top: string;
  bottom: string;
};

const heroLines: HeroLine[] = [
  { top: '\u00a0', bottom: 'BROKERS' },
  { top: 'BROKERS', bottom: 'ONBOARDING' },
  { top: 'ONBOARDING', bottom: 'MEMBERS' },
  { top: 'MEMBERS', bottom: 'CAMPAIGNS' },
  { top: 'CAMPAIGNS', bottom: 'STATES' },
  { top: 'STATES', bottom: 'PORTAL' },
  { top: 'PORTAL', bottom: '\u00a0' },
];

const legalLinkClass = 'text-white/70 underline-offset-2 transition-colors hover:text-white hover:underline';

const LayeredText = ({ lines }: { lines: HeroLine[] }) => {
  const centerIndex = Math.floor(lines.length / 2);

  return (
    <div className="login-layered-text auth-fade-in text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">
      <ul className="login-layered-text__list">
        {lines.map((line, index) => {
          const skew =
            index % 2 === 0
              ? 'skew(60deg, -30deg) scaleY(0.66667)'
              : 'skew(0deg, -30deg) scaleY(1.33333)';
          const style = {
            '--lt-skew': skew,
            '--lt-tx': `${(index - centerIndex) * 32}px`,
            '--lt-tx-md': `${(index - centerIndex) * 20}px`,
            '--lt-delay': `${index * 0.08}s`,
          } as CSSProperties;

          return (
            <li key={`${line.top}-${line.bottom}-${index}`} className="login-layered-text__line" style={style}>
              <div className="login-layered-text__col">
                <p className="login-layered-text__word">{line.top}</p>
                <p className="login-layered-text__word">{line.bottom}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  // Distinguishes an explicit sign-in (show welcome toast) from a restored
  // session, so the access check runs once and the toast fires only on sign-in.
  const justSignedInRef = useRef(false);

  const ensureAdminAccessOrSignOut = useCallback(
    async (userId: string): Promise<boolean> => {
      const hasAccess = await hasOnboardingPortalAccess(userId);

      if (!hasAccess) {
        await signOut();
        toast({
          title: 'Access denied',
          description: 'Only admin and super_admin users can access this portal.',
          variant: 'destructive',
        });
        return false;
      }

      return true;
    },
    [signOut, toast]
  );

  useEffect(() => {
    const checkUserRedirect = async () => {
      if (!user) return;

      const canAccess = await ensureAdminAccessOrSignOut(user.id);
      if (!canAccess) {
        justSignedInRef.current = false;
        return;
      }

      if (justSignedInRef.current) {
        justSignedInRef.current = false;
        toast({
          title: 'Welcome back!',
          description: 'You have been signed in successfully.',
        });
      }

      navigate('/dashboard');
    };

    checkUserRedirect();
  }, [user, navigate, ensureAdminAccessOrSignOut, toast]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Set before awaiting so the redirect effect (triggered by the auth state
    // change) sees the explicit sign-in even if it runs before signIn resolves.
    justSignedInRef.current = true;
    const { error, user: signedInUser } = await signIn(email, password);
    if (error || !signedInUser) {
      justSignedInRef.current = false;
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      <section className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <header>
          <img src="/assets/logo.svg" alt="Broker Management Portal" className="h-8 w-auto" />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="auth-fade-in w-full max-w-md">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">Welcome back</h1>
              <p className="text-sm leading-relaxed text-white/[0.55]">
                Sign in with your email to access the Broker Management Portal.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <label htmlFor="signin-email" className="text-sm font-medium text-white/70">
                  Email address
                </label>
                <input
                  id="signin-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-[#AE4010] focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#AE4010]/30"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="signin-password" className="text-sm font-medium text-white/70">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signin-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 text-sm text-white placeholder:text-white/30 transition-colors focus:border-[#AE4010] focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#AE4010]/30"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/40 transition-colors hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-[#AE4010]/40"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#AE4010] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(174,64,16,0.34)] transition hover:bg-[#7c2c0a] focus:outline-none focus:ring-2 focus:ring-[#AE4010]/45 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
                {!isLoading ? <ArrowRight className="h-4 w-4 opacity-80" /> : null}
              </button>
            </form>

            <div className="mt-6 h-px w-full bg-white/10" />
            <p className="mt-4 text-center text-xs leading-relaxed text-white/[0.45]">
              By signing in, you agree to our{' '}
              <Link to="/terms" className={legalLinkClass}>
                Terms & Conditions
              </Link>{' '}
              and our{' '}
              <Link to="/privacy-policy" className={legalLinkClass}>
                Privacy Policy
              </Link>
              .
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <p className="text-sm leading-relaxed text-white/[0.55]">
                <span className="font-medium text-white/80">Need access?</span> Contact your administrator to have your
                broker management workspace provisioned.
              </p>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-3 pt-8 text-xs text-white/[0.35] sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright {new Date().getFullYear()} Accident Payments. All rights reserved.</span>
          <span className="flex items-center gap-4">
            <Link to="/privacy-policy" className="transition-colors hover:text-white/70">
              Privacy Policy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-white/70">
              Terms & Conditions
            </Link>
          </span>
        </footer>
      </section>

      <section className="relative hidden p-3 lg:block lg:w-1/2">
        <div className="relative h-full w-full overflow-hidden rounded-[28px] ring-1 ring-white/10">
          <img src="/assets/bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

          <div className="absolute left-5 top-5 z-20 flex items-center gap-2.5 rounded-full border border-white/[0.15] bg-black/40 px-3.5 py-1.5 text-xs font-medium text-white/[0.85] backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F5A524] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#F5A524]" />
            </span>
            Broker Management Portal
          </div>

          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2.5 rounded-full border border-white/[0.15] bg-black/40 px-3.5 py-1.5 text-xs font-medium text-white/[0.85] backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            All Systems Operational
          </div>

          <div className="absolute inset-0 flex items-center justify-center px-8 xl:px-12">
            <LayeredText lines={heroLines} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
