export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* LEFT – Heritage Panel */}
      <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-orange-900 via-amber-800 to-rose-900 text-amber-100">
        <div className="text-center space-y-6 px-12">
          {/* LOGO / SYMBOL */}
          <div className="text-5xl">🕉️</div>

          <h1 className="text-4xl font-serif tracking-wide">
            Matoshree Study Lab
          </h1>

          <p className="italic text-lg text-amber-200">“विद्या विनयेन शोभते”</p>

          <p className="text-lg text-amber-200 leading-relaxed">
            A disciplined learning space inspired by the values of Rajmata Jijau
            and Chhatrapati Shivaji Maharaj <br></br> where focus, respect, and
            consistency shape success.
          </p>

          {/* Optional illustration */}
          <img
            src="/illustrations/login.jpg"
            alt="Fort Illustration"
            className="max-w-sm mx-auto opacity-80 rounded-xl"
          />
          <div className="pt-6 text-xs text-amber-300">
            © Discipline • Knowledge • Character
          </div>
        </div>
      </div>

      {/* RIGHT – Form Panel */}
      <div className="flex items-center justify-center bg-amber-50">
        {children}
      </div>
    </div>
  );
}
