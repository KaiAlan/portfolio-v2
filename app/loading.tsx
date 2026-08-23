const Loading = () => (
  <main className="w-full px-4 pb-16 sm:px-6 lg:px-9">
    <div className="mb-6 h-11 w-72 animate-pulse rounded-pill bg-surface" />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-card bg-surface-warm"
          style={{ aspectRatio: i % 3 === 0 ? '3 / 4' : '1 / 1' }}
        />
      ))}
    </div>
  </main>
)

export default Loading
