export function AnimatedBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 136, 0, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 136, 0, 0.04) 1px, transparent 1px),
            radial-gradient(circle at 50% 20%, rgba(255, 136, 0, 0.04), transparent 55%)
          `,
          backgroundSize: '56px 56px, 56px 56px, 100% 100%'
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(127, 143, 50, 0.045) 3px, rgba(127, 143, 50, 0.045) 4px)`
        }}
      />
    </div>
  );
}
