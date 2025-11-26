"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Plus, Search, Check, DollarSign } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity-logger";
import { currencyList } from "@/lib/utils";

// Interfaces
interface DriverPayment {
  id: string;
  driver_id: string;
  amount: number | string;
  status: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  drivers: {
    name: string;
    driver_number: string;
  };
}

interface TourPayment {
  id: string;
  tour_id: string;
  amount: number | string;
  status: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  tours: {
    booking_ref: string;
    client_name: string;
  };
}

interface Driver {
  id: string;
  name: string;
  driver_number: string;
}

interface Tour {
  id: string;
  booking_ref: string;
  client_name: string;
  value: string;
  label: string;
}

export default function PaymentsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const token = localStorage.getItem("auth_token");

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // gettourdropdown
  const gettours = `http://${baseUrl}/api/payment/tour`;
  // get active tour
  const activedrivers = `http://${baseUrl}/api/assign/drivers`;
  // create payments
  const createpayments = `http://${baseUrl}/api/payment`;

  // Tabs
  const [activeTab, setActiveTab] = useState("driver");

  // Driver data
  const [driverPayments, setDriverPayments] = useState<DriverPayment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  // Tour data
  const [tourPayments, setTourPayments] = useState<TourPayment[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);

  // Shared state
  const [searchDriver, setSearchDriver] = useState("");
  const [searchTour, setSearchTour] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    driver_id: "",
    tour_id: "",
    amount: "",
    currency: "",
    notes: "",
    status: "",
  });

  const [pageDriver, setPageDriver] = useState(1);
  const [pageSizeDriver, setPageSizeDriver] = useState(5);

  const [paginationDriver, setPaginationDriver] = useState({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [pageTour, setPageTour] = useState(1);
  const [pageSizeTour, setPageSizeTour] = useState(5);

  const [paginationTour, setPaginationTour] = useState({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    fetchTourPayments();
  }, [pageTour, pageSizeTour]);

  useEffect(() => {
    fetchDriverPayments();
  }, [pageDriver, pageSizeDriver]);
  // Fetch initial data
  useEffect(() => {
    fetchDrivers();
    fetchTours();
  }, []);

  useEffect(() => {
    fetchTourPayments();
  }, [searchTour]);

  useEffect(() => {
    fetchDriverPayments();
  }, [searchDriver]);

  // -------------------------
  // FETCH FUNCTIONS
  // -------------------------

  async function fetchDriverPayments() {
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${createpayments}/driver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          searchTerm: searchDriver,
          page: pageDriver,
          pageSize: pageSizeDriver,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setDriverPayments(res.data || []);
      setFilteredDrivers(res.data || []);

      // Save pagination info
      setPaginationDriver(res.pagination);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchTourPayments() {
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${createpayments}/tour`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          searchTerm: searchTour,
          page: pageTour,
          pageSize: pageSizeTour,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setTourPayments(res.data || []);
      setFilteredTours(res.data || []);

      // Save pagination info
      setPaginationTour(res.pagination);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchDrivers() {
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${activedrivers}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setDrivers(res.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function fetchTours() {
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${gettours}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setTours(res.tours || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  // -------------------------
  // CREATE PAYMENT
  // -------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!token) throw new Error("No auth token found");

      let response: Response;

      if (activeTab === "driver") {
        // DRIVER PAYMENT
        response = await fetch(createpayments, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            driver_id: formData.driver_id,
            tour_id: formData.tour_id,
            amount: formData.amount,
            currency: formData.currency,
            type: "driver_payment",
            status: formData.status,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("create", "driver_payment", null, formData);
        fetchDriverPayments(); // <-- only for driver tab
      } else {
        // TOUR PAYMENT
        response = await fetch(createpayments, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            driver_id: formData.driver_id,
            tour_id: formData.tour_id,
            amount: formData.amount,
            currency: formData.currency,
            type: "tour_payment",
            status: formData.status,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("create", "tour_payment", null, formData);
        fetchTourPayments(); // <-- only for tour tab
      }

      toast({
        title: "Success",
        description: "Payment created successfully",
      });

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // -------------------------
  // MARK AS PAID
  // -------------------------

  async function handleMarkAsPaid(item: any) {
    setLoading(true);
    try {
      await logActivity(
        "update",
        activeTab === "driver" ? "driver_payments" : "tour_payments",
        item.id,
        {
          action: "marked_as_paid",
        }
      );

      toast({
        title: "Success",
        description: "Payment marked as paid",
      });

      activeTab === "driver" ? fetchDriverPayments() : fetchTourPayments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // -------------------------
  // RESET FORM
  // -------------------------
  function resetForm() {
    setFormData({
      driver_id: "",
      tour_id: "",
      amount: "",
      currency: "",
      notes: "",
      status: "",
    });
  }

  // -------------------------
  // TOTALS
  // -------------------------

  const driverPending = driverPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const driverPaid = driverPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const tourPending = tourPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const tourPaid = tourPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  // -------------------------
  // MAIN RENDER
  // -------------------------

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="driver">Driver Payments</TabsTrigger>
            <TabsTrigger value="tour">Tour Payments</TabsTrigger>
          </TabsList>

          {/* ================================
              DRIVER PAYMENTS
          ================================= */}
          <TabsContent value="driver">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Driver Payment
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Create Driver Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Driver</Label>
                      <Select
                        value={formData.driver_id}
                        onValueChange={(v) =>
                          setFormData({ ...formData, driver_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} — {d.driver_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(v) =>
                          setFormData({ ...formData, currency: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyList.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} — {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Pending Payments
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${driverPending.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {
                      driverPayments.filter((p) => p.status === "Pending")
                        .length
                    }{" "}
                    pending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Paid Total
                  </CardTitle>
                  <Check className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${driverPaid.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {driverPayments.filter((p) => p.status === "paid").length}{" "}
                    completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Payments
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(driverPending + driverPaid).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {driverPayments.length} total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            {/* <Card className="mt-6">
              <CardHeader>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 text-gray-400" />
                    <Input
                      placeholder="Search drivers..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium">Driver</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Payment Date</th>
                      <th className="pb-3 font-medium">Notes</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDriverPayments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-4">
                          <p className="font-medium">{p.drivers.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.drivers.driver_number}
                          </p>
                        </td>

                        <td className="py-4 font-mono">
                          ${parseFloat(p.amount.toString()).toFixed(2)}
                        </td>

                        <td className="py-4">
                          <Badge
                            className={
                              p.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-orange-100 text-orange-800"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>

                        <td className="py-4 text-sm">
                          {p.payment_date
                            ? new Date(p.payment_date).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-4 text-sm">{p.notes || "-"}</td>

                        <td className="py-4">
                          {p.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsPaid(p)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Mark Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredDriverPayments.length === 0 && (
                  <div className="py-12 text-center text-gray-500">
                    No payments found
                  </div>
                )}
              </CardContent>
            </Card> */}
          </TabsContent>

          {/* ==================================
              TOUR PAYMENTS
          ================================== */}
          <TabsContent value="tour">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Tour Payment
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Create Tour Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tour</Label>
                      <Select
                        value={formData.tour_id}
                        onValueChange={(v) =>
                          setFormData({ ...formData, tour_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tour" />
                        </SelectTrigger>
                        <SelectContent>
                          {tours.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(v) =>
                          setFormData({ ...formData, currency: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyList.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} — {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Pending Payments
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${tourPending.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tourPayments.filter((p) => p.status === "pending").length}{" "}
                    pending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Paid Total
                  </CardTitle>
                  <Check className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${tourPaid.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tourPayments.filter((p) => p.status === "paid").length}{" "}
                    completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Payments
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(tourPending + tourPaid).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tourPayments.length} total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            {/* <Card className="mt-6">
              <CardHeader>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 text-gray-400" />
                    <Input
                      placeholder="Search tours..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium">Tour</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Payment Date</th>
                      <th className="pb-3 font-medium">Notes</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTourPayments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-4">
                          <p className="font-medium">{p.tours.booking_ref}</p>
                          <p className="text-xs text-gray-500">
                            {p.tours.client_name}
                          </p>
                        </td>

                        <td className="py-4 font-mono">
                          ${parseFloat(p.amount.toString()).toFixed(2)}
                        </td>

                        <td className="py-4">
                          <Badge
                            className={
                              p.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-orange-100 text-orange-800"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>

                        <td className="py-4 text-sm">
                          {p.payment_date
                            ? new Date(p.payment_date).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-4 text-sm">{p.notes || "-"}</td>

                        <td className="py-4">
                          {p.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsPaid(p)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Mark Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredTourPayments.length === 0 && (
                  <div className="py-12 text-center text-gray-500">
                    No payments found
                  </div>
                )}
              </CardContent>
            </Card> */}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
