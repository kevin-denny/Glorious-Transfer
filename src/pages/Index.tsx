import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Calendar, DollarSign, Activity } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Tourism Management System</h1>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="mb-4 text-5xl font-bold text-foreground">
            Streamline Your Tourism Operations
          </h2>
          <p className="mb-8 text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete management solution for drivers, tours, and payments. Built for efficiency and transparency.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}>
            Get Started
          </Button>
        </section>

        <section className="bg-card py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Driver Management</h3>
                <p className="text-muted-foreground">
                  Register and track drivers with auto-generated IDs and comprehensive details
                </p>
              </div>

              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Tour Operations</h3>
                <p className="text-muted-foreground">
                  Manage bookings, assignments, and scheduling with ease
                </p>
              </div>

              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Payment Tracking</h3>
                <p className="text-muted-foreground">
                  Monitor pending payments and process driver compensation
                </p>
              </div>

              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Activity className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Activity Monitoring</h3>
                <p className="text-muted-foreground">
                  Real-time tracking of all system operations and changes
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground">Ready to get started?</h2>
          <p className="mb-8 text-muted-foreground">
            Sign up now and start managing your tourism operations efficiently
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}>
            Create Account
          </Button>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 Tourism Management System. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
