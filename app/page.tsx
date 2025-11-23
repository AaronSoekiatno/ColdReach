import ResumeUpload from './components/ResumeUpload';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-12 px-4">
        <ResumeUpload />
      </main>
    </div>
  );
}
