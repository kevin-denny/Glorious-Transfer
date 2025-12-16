"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Calendar,
  DollarSign,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  CreditCard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  filter_info: {
    current_month_only: boolean;
    period: string;
    month_name?: string;
    month_prefix?: string;
  };
  stats: {
    tours: {
      total: number;
      pending: number;
      assigned: number;
      completed: number;
      cancelled: number;
    };
    drivers: {
      total: number;
      active: number;
    };
    payments: {
      total: number;
      driver_payments: {
        pending: number;
        partial: number;
        completed: number;
        total: number;
      };
      tour_payments: {
        pending: number;
        partial: number;
        confirmed: number;
        total: number;
      };
    };
    complaints: {
      total: number;
    };
  };
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API;
  const getstats = `http://${baseUrl}/api/dashboard`;

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [currentMonthOnly, setCurrentMonthOnly] = useState(true);

  useEffect(() => {
    // Set token from localStorage after component mounts
    setToken(localStorage.getItem("auth_token"));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile && token && !authLoading) {
      fetchStats();
    }
  }, [profile, currentMonthOnly, token, authLoading]);

  async function fetchStats() {
    try {
      if (!token || !profile) {
        console.log("Skipping fetchStats - no auth");
        return;
      }
      setLoading(true);

      const response = await fetch(getstats, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_month_only: currentMonthOnly }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setDashboardData(res.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !profile) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
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
        </div>
      </DashboardLayout>
    );
  }

  if (loading || !dashboardData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(6)].map((_, i) => (
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
        </div>
      </DashboardLayout>
    );
  }

  const stats = dashboardData.stats;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {profile.full_name}
            </h1>
            <p className="text-gray-500 mt-1">
              {dashboardData.filter_info.month_name
                ? `${dashboardData.filter_info.month_name} Overview`
                : "Complete Overview"}
            </p>
          </div>

          {/* <div className="flex items-center space-x-2">
            <Label htmlFor="month-filter" className="text-sm font-medium">
              Current Month Only
            </Label>
            <Switch
              id="month-filter"
              checked={currentMonthOnly}
              onCheckedChange={setCurrentMonthOnly}
            />
          </div> */}
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Tours Overview */}
          {["operations", "administrator"].includes(profile.role) && (
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Tours
                </CardTitle>
                <Badge variant="outline" className="text-xl font-bold">
                  {stats.tours.total}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-yellow-50 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                    <div className="text-sm font-medium text-yellow-800">
                      Pending
                    </div>
                    <div className="text-lg font-bold text-yellow-600">
                      {stats.tours.pending}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <UserCheck className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-sm font-medium text-blue-800">
                      Assigned
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {stats.tours.assigned}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                    <div className="text-sm font-medium text-green-800">
                      Completed
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {stats.tours.completed}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <XCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                    <div className="text-sm font-medium text-red-800">
                      Cancelled
                    </div>
                    <div className="text-lg font-bold text-red-600">
                      {stats.tours.cancelled}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Drivers Overview */}
          {["operations", "administrator"].includes(profile.role) && (
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Car className="h-5 w-5 text-green-600" />
                  Drivers
                </CardTitle>
                <Badge variant="outline" className="text-xl font-bold">
                  {stats.drivers.total}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Active Drivers
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {stats.drivers.active}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-800">
                      Inactive
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-gray-600">
                    {stats.drivers.total - stats.drivers.active}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Complaints */}
          {["operations", "administrator"].includes(profile.role) && (
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Complaints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6">
                  <div className="text-4xl font-bold text-red-600 mb-2">
                    {stats.complaints.total}
                  </div>
                  <div className="text-sm text-gray-500">
                    {stats.complaints.total > 0
                      ? "Requires attention"
                      : "No complaints"}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payments Section */}
        {["finance", "administrator"].includes(profile.role) && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Driver Payments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                  Driver Payments
                  <Badge variant="secondary">
                    {stats.payments.driver_payments.total}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-yellow-800">
                      Pending
                    </div>
                    <div className="text-xl font-bold text-yellow-600">
                      {stats.payments.driver_payments.pending}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-orange-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-orange-800">
                      Partial
                    </div>
                    <div className="text-xl font-bold text-orange-600">
                      {stats.payments.driver_payments.partial}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-green-800">
                      Completed
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {stats.payments.driver_payments.completed}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tour Payments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Tour Payments
                  <Badge variant="secondary">
                    {stats.payments.tour_payments.total}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-yellow-800">
                      Pending
                    </div>
                    <div className="text-xl font-bold text-yellow-600">
                      {stats.payments.tour_payments.pending}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-blue-800">
                      Partial
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {stats.payments.tour_payments.partial}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                    <div className="text-xs font-medium text-green-800">
                      Confirmed
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {stats.payments.tour_payments.confirmed}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
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
