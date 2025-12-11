"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { supabase } from '@/lib/supabase';
import { Car, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const token = localStorage.getItem("auth_token");

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // getstats
  const getstats = `http://${baseUrl}/api/dashboard`;

  const [stats, setStats] = useState({
    totalDrivers: 0,
    activeDrivers: 0,
    totalTours: 0,
    pendingTours: 0,
    pendingPaymentsDriver: 0,
    pendingPaymentsTrip: 0,
    totalComplaints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  async function fetchStats() {
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${getstats}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();

      console.log("Pool", res.data);

      // const activeDrivers = driversRes.data?.filter(d => d.status === 'active').length || 0;
      // const pendingTours = toursRes.data?.filter(t => t.status === 'pending' || t.status === 'assigned').length || 0;
      const activeDrivers = 0;
      const pendingTours = 0;

      // setStats({
      //   totalDrivers: driversRes.count || 0,
      //   activeDrivers,
      //   totalTours: toursRes.count || 0,
      //   pendingTours,
      //   pendingPayments: paymentsRes.count || 0,
      //   totalComplaints: complaintsRes.count || 0,
      // });
      setStats({
        totalDrivers: res.data?.stats.drivers.total,
        activeDrivers: res.data?.stats.drivers.active,
        totalTours: res.data?.stats.tours.total,
        pendingTours: res.data?.stats.tours.pending,
        pendingPaymentsDriver: res.data?.stats.payments.driver_payments.pending,
        pendingPaymentsTrip: res.data?.stats.payments.tour_payments.pending,
        totalComplaints: res.data?.stats.complaints.total,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !profile) {
    return (
      <DashboardLayout>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const cards = [
    {
      title: "Total Drivers",
      value: stats.totalDrivers,
      subtitle: `${stats.activeDrivers} active`,
      icon: Car,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      show: ["administrator"].includes(profile.role),
    },
    {
      title: "Total Tours",
      value: stats.totalTours,
      subtitle: `${stats.pendingTours} pending`,
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-50",
      show: ["administrator", "operations"].includes(profile.role),
    },
    {
      title: "Open Complaints",
      value: stats.totalComplaints,
      subtitle: "Requires attention",
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      show: ["administrator"].includes(profile.role),
    },
    {
      title: "Pending Payments",
      value: `Driver ${stats.pendingPaymentsDriver} Pending`,
      subtitle: `Trip ${stats.pendingPaymentsTrip} Pending`,
      icon: DollarSign,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      show: ["administrator", "finance"].includes(profile.role),
    },
  ].filter((card) => card.show);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {profile.full_name}
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening with your operations
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="border-l-4 hover:shadow-md transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={cn(card.bgColor, "rounded-full p-2")}>
                  <card.icon className={cn("h-5 w-5", card.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {loading ? "..." : card.value}
                </div>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {profile.role === "administrator" && (
                <button
                  onClick={() => router.push("/dashboard/drivers")}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <Car className="h-8 w-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Manage Drivers</p>
                    <p className="text-sm text-gray-500">Add or edit drivers</p>
                  </div>
                </button>
              )}
              {["administrator", "operations"].includes(profile.role) && (
                <button
                  onClick={() => router.push("/dashboard/tours")}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <Calendar className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Manage Tours</p>
                    <p className="text-sm text-gray-500">
                      Schedule and assign tours
                    </p>
                  </div>
                </button>
              )}
              {["administrator", "finance"].includes(profile.role) && (
                <button
                  onClick={() => router.push("/dashboard/payments")}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <DollarSign className="h-8 w-8 text-orange-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">
                      Process Payments
                    </p>
                    <p className="text-sm text-gray-500">
                      Review pending payments
                    </p>
                  </div>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
