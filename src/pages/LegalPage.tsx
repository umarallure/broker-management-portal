import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type LegalPageProps = {
  type: 'privacy' | 'terms';
};

const content = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated June 11, 2026',
    intro:
      'This Privacy Policy explains how Accident Payments handles information inside the Broker Management Portal.',
    sections: [
      {
        title: 'Information We Process',
        body:
          'We process account credentials, administrator profile details, broker profile information, broker member records, activity metadata, and security logs needed to operate the portal.',
      },
      {
        title: 'How Information Is Used',
        body:
          'Information is used to authenticate authorized users, manage broker onboarding, maintain broker account records, support broker portal launches, monitor access, and improve operational reliability.',
      },
      {
        title: 'Access And Security',
        body:
          'Portal access is restricted to authorized users. Administrative access, role checks, audit trails, and Supabase-backed authentication are used to protect broker management workflows.',
      },
      {
        title: 'Data Retention',
        body:
          'Broker and account records are retained as long as needed for business operations, legal obligations, dispute resolution, security monitoring, and account administration.',
      },
      {
        title: 'Contact',
        body:
          'For privacy questions or account data requests, contact your Accident Payments administrator or the operations team responsible for your portal access.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    updated: 'Last updated June 11, 2026',
    intro:
      'These Terms & Conditions govern use of the Accident Payments Broker Management Portal.',
    sections: [
      {
        title: 'Authorized Use',
        body:
          'This portal is intended only for authorized Accident Payments administrators and approved operational users managing broker onboarding and broker account records.',
      },
      {
        title: 'Account Responsibility',
        body:
          'You are responsible for keeping your credentials secure, signing out of shared devices, and reporting suspicious access or incorrect account permissions promptly.',
      },
      {
        title: 'Broker Data',
        body:
          'Broker profile, member, campaign, state, contact, and account-status information must be entered accurately and used only for legitimate broker management operations.',
      },
      {
        title: 'Service Availability',
        body:
          'The portal may be updated, restricted, or temporarily unavailable during maintenance, security reviews, infrastructure incidents, or operational changes.',
      },
      {
        title: 'Policy Compliance',
        body:
          'Users must follow applicable internal policies, contractual obligations, and laws when accessing, editing, exporting, or sharing information from the portal.',
      },
    ],
  },
} as const;

const LegalPage = ({ type }: LegalPageProps) => {
  const page = content[type];
  const alternate = type === 'privacy' ? { to: '/terms', label: 'Terms & Conditions' } : { to: '/privacy-policy', label: 'Privacy Policy' };

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <img src="/assets/logo.svg" alt="Broker Management Portal" className="h-8 w-auto" />
        </header>

        <section className="auth-fade-in flex flex-1 items-center py-12">
          <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
            <p className="text-xs font-medium uppercase text-[#F5A524]">{page.updated}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">{page.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.58]">{page.intro}</p>

            <div className="mt-8 space-y-6">
              {page.sections.map((section) => (
                <section key={section.title} className="border-t border-white/10 pt-5">
                  <h2 className="text-sm font-semibold text-white/[0.85]">{section.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-white/[0.55]">{section.body}</p>
                </section>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
              <span>Copyright {new Date().getFullYear()} Accident Payments. All rights reserved.</span>
              <Link to={alternate.to} className="text-white/70 transition-colors hover:text-white">
                {alternate.label}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LegalPage;
