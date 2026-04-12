import { PostGenerator } from "@/components/post-generator";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex-1">
        <PostGenerator />
      </section>
    </main>
  );
}
