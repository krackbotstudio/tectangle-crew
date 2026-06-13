import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Workflow,
  Shield,
  Zap,
  MessageSquare,
  FolderKanban,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const features = [
  {
    icon: Users,
    title: "Team agents",
    description: "Dedicated AI agents for Content, Design, Marketing, Sales, HR, and more.",
  },
  {
    icon: Workflow,
    title: "n8n automations",
    description: "Connect workflows, webhooks, and scheduled jobs from one control plane.",
  },
  {
    icon: FolderKanban,
    title: "Project groups",
    description: "Assign agents across teams to collaborate on shared goals.",
  },
  {
    icon: MessageSquare,
    title: "Unified chat",
    description: "Chat with any agent, review tasks, and manage knowledge in one place.",
  },
  {
    icon: Shield,
    title: "Access control",
    description: "Invite members, assign teams and projects, and manage roles.",
  },
  {
    icon: Zap,
    title: "Always on",
    description: "Agents run on autopilot with n8n triggers and human-in-the-loop approvals.",
  },
];

export function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-full bg-black text-white">
      {/* ── Hero ── */}
      <section id="home" className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Sky & mist */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0a12] via-[#080810] to-black" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_85%,rgba(134,59,255,0.14)_0%,transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_70%,rgba(126,20,255,0.08)_0%,transparent_50%)]" />

        {/* Mountain silhouettes */}
        <svg
          className="pointer-events-none absolute bottom-0 left-0 w-full text-[#0d0d14]"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            opacity="0.5"
          />
          <path
            fill="currentColor"
            d="M0,256L80,245.3C160,235,320,213,480,208C640,203,800,213,960,224C1120,235,1280,245,1360,250.7L1440,256L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
            opacity="0.85"
          />
        </svg>

        <div className="landing-grain pointer-events-none absolute inset-0 z-[1]" />

        {/* Nav — full width */}
        <header className="relative z-20 w-full px-6 pt-6 lg:px-12 xl:px-16">
          <div className="flex w-full items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/favicon.svg" alt="Agent Desk" className="h-9 w-9 rounded-lg" />
              <span className="hidden text-sm font-semibold tracking-wide text-white/90 sm:inline">
                Agent Desk
              </span>
            </Link>

            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
              {navLinks.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="landing-nav-link uppercase text-white/70 transition hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="landing-nav-link hidden uppercase text-white/70 transition hover:text-white sm:inline"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full border border-brand-purple/40 bg-brand-purple/10 px-4 py-2 text-xs font-medium tracking-wide text-brand-purple-soft transition hover:border-brand-purple/70 hover:bg-brand-purple/20"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        {/* Headline — full width */}
        <div className="relative z-10 w-full px-6 pt-16 text-center sm:pt-20 lg:px-12">
          <h1 className="mx-auto max-w-6xl text-3xl font-bold uppercase leading-[1.08] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
            AI agents to run
            <br />
            your entire business
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-[10px] uppercase leading-relaxed tracking-[0.22em] text-white/50 sm:text-xs lg:text-sm">
            Support your growth every step of the way — chat, automate, and
            collaborate from one workspace
          </p>
        </div>

        {/* Beam — full viewport width, centered */}
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-end pb-36 sm:pb-40">
          <div className="relative flex h-[min(58vh,520px)] w-full max-w-none flex-col items-center justify-end">
            <div className="landing-beam-wide absolute bottom-0 h-full w-40 md:w-56 lg:w-72" />
            <div className="landing-beam-container relative h-full w-2 md:w-2.5 lg:w-3">
              <div className="landing-beam-core absolute inset-0" />
              <div className="landing-beam-track absolute inset-0">
                <div className="landing-beam-pulse landing-beam-pulse--primary" />
                <div className="landing-beam-pulse landing-beam-pulse--fast" />
                <div className="landing-beam-pulse landing-beam-pulse--trail" />
              </div>
              <div className="landing-beam-flare absolute inset-0" aria-hidden />
            </div>
            <a
              href="#features"
              className="absolute bottom-0 flex flex-col items-center gap-1.5 text-[10px] uppercase tracking-[0.32em] text-white/45 transition hover:text-brand-purple-soft sm:text-xs"
            >
              Discover more
              <ChevronDown className="h-4 w-4 animate-bounce text-brand-purple" />
            </a>
          </div>
        </div>

        {/* Stats — pinned to screen edges, scaled up */}
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex w-full items-end justify-between px-6 sm:bottom-20 sm:px-10 md:px-16 lg:px-24 xl:px-32">
          <div className="text-left">
            <div className="text-5xl font-bold leading-none tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl">
              6+
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/40 sm:mt-3 sm:text-xs md:text-sm">
              Team agents
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold leading-none tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl">
              10×
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/40 sm:mt-3 sm:text-xs md:text-sm">
              Faster workflows
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="landing-mountain pointer-events-none absolute inset-x-0 bottom-0 h-32" />
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative border-t border-white/5 bg-black px-4 py-20 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_50%_0%,rgba(134,59,255,0.06)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-brand-purple">Features</p>
            <h2 className="mt-3 text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
              Everything to deploy AI agents
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition hover:border-brand-purple/30 hover:bg-brand-purple/[0.04]"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] transition group-hover:border-brand-purple/40 group-hover:shadow-[0_0_20px_rgba(134,59,255,0.15)]">
                  <Icon className="h-5 w-5 text-white/60 transition group-hover:text-brand-purple-soft" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/45">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-brand-purple">About</p>
            <h2 className="mt-3 text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
              Your multi-agent command center
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/45">
              Agent Desk gives every team a dedicated AI agent powered by n8n automations.
              Chat on demand, run scheduled jobs, manage knowledge bases, and orchestrate
              cross-team projects — all without writing code.
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-purple px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-purple-bright"
            >
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative flex items-center justify-center py-8">
            <div className="landing-beam-wide absolute h-48 w-48 rounded-full" />
            <img
              src="/favicon.svg"
              alt=""
              className="relative h-32 w-32 drop-shadow-[0_0_40px_rgba(134,59,255,0.5)] sm:h-40 sm:w-40"
              aria-hidden
            />
          </div>
        </div>
      </section>

      {/* ── Contact / CTA ── */}
      <section id="contact" className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-brand-purple/20 bg-brand-purple/[0.04] px-6 py-12 text-center sm:px-10">
          <h2 className="text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-sm text-white/45">
            Create a free account or sign in with Google to launch your agent workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-8 py-3 text-sm font-medium text-white transition hover:bg-brand-purple-bright sm:w-auto"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm text-white/70 transition hover:border-white/30 hover:text-white sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-white/30 sm:px-6">
        © {new Date().getFullYear()} Agent Desk
      </footer>
    </div>
  );
}
