import { PostGenerator } from "@/components/post-generator";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
      <section className="grid flex-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between rounded-[2rem] border border-panel-border bg-panel p-7 shadow-[0_24px_80px_rgba(32,24,16,0.08)] backdrop-blur md:p-10">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center rounded-full border border-panel-border bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.28em] text-muted">
              SMA3 personal tool
            </div>
            <div className="space-y-5">
              <p className="font-mono text-sm uppercase tracking-[0.24em] text-accent">
                Brief in. Post out.
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-balance sm:text-5xl lg:text-6xl">
                Turn rough notes into a sharp X post in one pass.
              </h1>
              <p className="max-w-xl text-base leading-8 text-muted sm:text-lg">
                Drop in a topic, launch note, or half-formed idea. The app uses
                OpenAI to turn it into a short, publishable post that stays
                tight and platform-friendly.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <div className="rounded-3xl border border-panel-border bg-white/60 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent">
                Focused
              </p>
              <p className="mt-2 leading-7">
                Built for one job: fast copy you can actually post.
              </p>
            </div>
            <div className="rounded-3xl border border-panel-border bg-white/60 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent">
                Adjustable
              </p>
              <p className="mt-2 leading-7">
                Pick a tone before generating instead of rewriting later.
              </p>
            </div>
            <div className="rounded-3xl border border-panel-border bg-white/60 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent">
                X-ready
              </p>
              <p className="mt-2 leading-7">
                Responses are kept short and checked against the character cap.
              </p>
            </div>
          </div>
        </div>

        <PostGenerator />
      </section>
    </main>
  );
}
