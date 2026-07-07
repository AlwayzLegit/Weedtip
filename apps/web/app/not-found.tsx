import { Link } from 'next-view-transitions';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="text-muted mt-2 text-sm">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/">
          <Button>Back home</Button>
        </Link>
        <Link href="/dispensaries">
          <Button variant="outline">Find dispensaries</Button>
        </Link>
      </div>
    </main>
  );
}
