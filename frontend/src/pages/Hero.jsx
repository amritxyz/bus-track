import { Link } from 'react-router-dom';
import {
  BusFront,
  Users,
  MapPin,
  Clock,
  Navigation,
  Smartphone,
  ArrowRight,
  Zap,
  Shield,
  Star,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Animated Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 backdrop-blur-sm">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </div>
              <span className="text-sm font-medium text-cyan-400">Now Live in Butwal</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-tight">
            Track Buses.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live & Free.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
            Real-time bus tracking for Butwal. No apps, no hassle.
            <br className="hidden md:inline" /> Just open your browser and see where your bus is.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/auth-passenger" className="w-full sm:w-auto">
              <button className="group flex items-center justify-center w-full h-16 px-8 text-lg font-semibold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/30 border-0 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
                <Users className="w-6 h-6 mr-3" />
                Track Bus
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link to="/auth-driver" className="w-full sm:w-auto">
              <button className="group flex items-center justify-center w-full h-16 px-8 text-lg font-semibold rounded-2xl bg-white/5 border border-white/20 text-white hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
                <BusFront className="w-6 h-6 mr-3" />
                I'm a Driver
              </button>
            </Link>
          </div>

          {/* Stats — Now Fully Centered & Cleaner */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { value: 'Live', label: 'Updates' },
              { value: 'Free', label: 'Forever' },
              { value: 'Easy', label: 'One-Tap' },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-4"
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs sm:text-sm text-slate-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
          >
            <path
              d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z"
              fill="url(#wave-gradient)"
            />
            <defs>
              <linearGradient id="wave-gradient" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0f172a" stopOpacity="0" />
                <stop offset="1" stopColor="#0f172a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative bg-slate-950 py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-sm font-semibold text-blue-400 mb-4">
              FEATURES
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4">
              Built for Nepal
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Every feature designed to make your daily commute smoother
            </p>
          </div>

          {/* Grid: 1 → 3 cols, all cards centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: Navigation,
                title: 'Real-Time GPS',
                desc: 'See exactly where buses are right now. Updated every 3 seconds with pinpoint accuracy.',
                color: 'from-cyan-500 to-blue-600',
                glow: 'from-cyan-500/20',
              },
              {
                icon: Zap,
                title: 'Instant Booking',
                desc: 'One tap on the map. That’s it. No forms, no waiting — just book and go.',
                color: 'from-blue-500 to-purple-600',
                glow: 'from-blue-500/20',
              },
              {
                icon: MapPin,
                title: 'All Routes',
                desc: 'Devinagar, Tilottama, Manigram, Sunauli — every major route in Butwal covered.',
                color: 'from-purple-500 to-pink-600',
                glow: 'from-purple-500/20',
              },
              {
                icon: Clock,
                title: 'Live Status',
                desc: 'Know if you’re waiting, picked up, or dropped off — real-time sync for all.',
                color: 'from-green-500 to-emerald-600',
                glow: 'from-green-500/20',
              },
              {
                icon: Smartphone,
                title: 'No App Needed',
                desc: 'Works on any browser — phone, tablet, laptop. No downloads, no storage.',
                color: 'from-orange-500 to-red-600',
                glow: 'from-orange-500/20',
              },
              {
                icon: BusFront,
                title: 'Visual Tracking',
                desc: 'Color-coded bus icons 🚌 make finding your ride instant and intuitive.',
                color: 'from-yellow-500 to-orange-600',
                glow: 'from-yellow-500/20',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="group relative bg-gradient-to-br from-slate-900/80 to-slate-800/70 backdrop-blur-sm rounded-3xl p-7 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/10 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" style={{ background: `linear-gradient(to bottom right, ${item.glow}, transparent)` }}></div>
                  <div className="relative flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-slate-400 text-base leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works — Now Symmetric & Centered */}
      <section className="relative bg-gradient-to-b from-slate-950 to-slate-900 py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4">
            Simple as 1-2-3
          </h2>
          <p className="text-lg text-slate-400 mb-12">
            Three steps to never miss your bus again
          </p>

          <div className="space-y-16">
            {[
              {
                step: 1,
                title: 'Driver Goes Online',
                desc: 'Bus driver opens the app and starts sharing their location. That’s all they need to do.',
                color: 'from-cyan-500 to-blue-600',
              },
              {
                step: 2,
                title: 'You See the Bus',
                desc: 'The bus appears on your map instantly. Watch it move in real-time as it approaches.',
                color: 'from-purple-500 to-pink-600',
              },
              {
                step: 3,
                title: 'Tap to Book',
                desc: 'Click the bus icon on the map. You’re booked. The driver gets notified immediately.',
                color: 'from-green-500 to-emerald-600',
              },
            ].map((stepItem, idx) => (
              <div key={idx} className="flex flex-col items-center gap-8">
                {/* Step Circle */}
                <div className="relative w-24 h-24 md:w-32 md:h-32">
                  <div
                    className={`absolute inset-0 rounded-full animate-pulse ${stepItem.color}`}
                    style={{ animationDelay: `${idx * 300}ms` }}
                  ></div>
                  <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-4xl md:text-6xl font-black text-white">{stepItem.step}</span>
                  </div>
                </div>

                <div className="max-w-xl">
                  <h3 className="text-2xl md:text-3xl font-bold mb-3">{stepItem.title}</h3>
                  <p className="text-slate-300 text-lg leading-relaxed">{stepItem.desc}</p>
                </div>

                {idx < 2 && (
                  <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 via-purple-500 to-green-500 rounded-full"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — Heroic & Centered */}
      <section className="relative bg-slate-900 py-24 md:py-32 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5"></div>
        <div className="relative max-w-3xl mx-auto text-center">
          {/* Rating Stars */}
          <div className="flex justify-center gap-1 mb-8">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-7 h-7 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
            ))}
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6">
            Start tracking buses
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              right now
            </span>
          </h2>

          <p className="text-xl text-slate-300 mb-10">
            Free. Simple. Built for Butwal.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-8">
            <Link to="/auth?role=passenger" className="w-full sm:w-auto">
              <button className="group flex items-center justify-center w-full h-16 px-8 text-lg font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/40 transition-all duration-300 hover:scale-[1.04] active:scale-[0.98]">
                <Users className="w-6 h-6 mr-3" />
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </Link>
            <Link to="/auth?role=driver" className="w-full sm:w-auto">
              <button className="group flex items-center justify-center w-full h-16 px-8 text-lg font-bold rounded-2xl bg-white/5 border border-white/30 text-white hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-[1.04] active:scale-[0.98]">
                <BusFront className="w-6 h-6 mr-3" />
                Join as Driver
              </button>
            </Link>
          </div>

          <p className="text-slate-500 text-sm">
            No credit card required • No app download • Works everywhere
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-slate-950/90 backdrop-blur-sm border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <BusFront className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">BusTracker Nepal</div>
                <div className="text-sm text-slate-500">Butwal's Bus Tracking System</div>
              </div>
            </div>
            <div className="text-sm text-slate-500">
              © {new Date().getFullYear()} BusTracker Nepal. Made with ❤️ for Butwal
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
