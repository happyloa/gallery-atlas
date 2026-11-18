export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col justify-center gap-6 px-6 py-16 sm:px-12">
      <p className="text-sm uppercase tracking-[0.2em] text-accent">
        Gallery Atlas
      </p>
      <h1 className="max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
        Art is worth lingering over.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-muted">
        An independent space to discover, appreciate, and curate public-domain
        art. The collection is being hung — check back soon.
      </p>
      <p className="max-w-xl text-sm leading-6 text-muted">
        This is an independent project and is not affiliated with the Art
        Institute of Chicago.
      </p>
    </main>
  );
}
