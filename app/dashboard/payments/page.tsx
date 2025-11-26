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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity-logger";
import { currencyList } from "@/lib/utils";

interface Payment {
  id: string;
  driver_id: string;
  tour_id: string | null;
  amount: number | string;
  status: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  drivers: {
    name: string;
    driver_number: string;
  };
  tours?: {
    booking_ref: string;
    client_name: string;
  } | null;
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
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    driver_id: "",
    tour_id: "",
    amount: "",
    currency: "",
    notes: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchDrivers();
    fetchTours();
  }, []);

  useEffect(() => {
    let filtered = payments;

    if (filterStatus !== "all") {
      filtered = filtered.filter((p) => p.status === filterStatus);
    }

    if (search) {
      filtered = filtered.filter(
        (payment) =>
          payment.drivers.name.toLowerCase().includes(search.toLowerCase()) ||
          payment.drivers.driver_number
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          payment.tours?.booking_ref
            .toLowerCase()
            .includes(search.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  }, [search, filterStatus, payments]);

  async function fetchPayments() {
    try {
      // const { data, error } = await supabase
      //   .from('driver_payments')
      //   .select(`
      //     *,
      //     drivers!inner (name, driver_number),
      //     tours (booking_ref, client_name)
      //   `)
      //   .order('created_at', { ascending: false });

      // if (error) throw error;
      // setPayments(data || []);
      // setFilteredPayments(data || []);
      setPayments([]);
      setFilteredPayments([]);
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
      // const { data, error } = await supabase
      //   .from('drivers')
      //   .select('id, name, driver_number')
      //   .eq('status', 'active')
      //   .order('name');

      // if (error) throw error;
      // setDrivers(data || []);
      setDrivers([]);
    } catch (error: any) {
      console.error("Error fetching drivers:", error);
    }
  }

  async function fetchTours() {
    try {
      // const { data, error } = await supabase
      //   .from('tours')
      //   .select('id, booking_ref, client_name')
      //   .eq('status', 'completed')
      //   .order('booking_date', { ascending: false });

      // if (error) throw error;
      // setTours(data || []);
      setTours([]);
    } catch (error: any) {
      console.error("Error fetching tours:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // const { error } = await supabase.from('driver_payments').insert({
      //   driver_id: formData.driver_id,
      //   tour_id: formData.tour_id || null,
      //   amount: parseFloat(formData.amount),
      //   notes: formData.notes,
      //   updated_by: profile?.id,
      // });

      // if (error) throw error;

      await logActivity("create", "driver_payments", null, formData);

      toast({
        title: "Success",
        description: "Payment record created successfully",
      });

      fetchPayments();
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

  async function handleMarkAsPaid(payment: Payment) {
    setLoading(true);
    try {
      // const { error } = await supabase
      //   .from('driver_payments')
      //   .update({
      //     status: 'paid',
      //     payment_date: new Date().toISOString().split('T')[0],
      //     updated_by: profile?.id,
      //   })
      //   .eq('id', payment.id);

      // if (error) throw error;

      await logActivity("update", "driver_payments", payment.id, {
        action: "marked_as_paid",
        payment_date: new Date().toISOString(),
      });

      toast({
        title: "Success",
        description: "Payment marked as paid",
      });

      fetchPayments();
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

  function resetForm() {
    setFormData({
      driver_id: "",
      tour_id: "",
      amount: "",
      currency: "",
      notes: "",
    });
    setSelectedPayment(null);
  }

  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Driver Payments</h1>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Payment Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tour_id">Tour</Label>
                    <Select
                      value={formData.tour_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tour_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tour" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* <SelectItem value="">None</SelectItem>
                      {tours.map((tour) => (
                        <SelectItem key={tour.id} value={tour.id}>
                          {tour.booking_ref} - {tour.client_name}
                        </SelectItem>
                      ))} */}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, currency: value })
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    Create Payment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                ${totalPending.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {payments.filter((p) => p.status === "pending").length} pending
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
              <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                {payments.filter((p) => p.status === "paid").length} completed
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
                ${(totalPending + totalPaid).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {payments.length} total
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by driver or booking ref..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Driver</th>
                    <th className="pb-3 font-medium">Tour</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Payment Date</th>
                    <th className="pb-3 font-medium">Notes</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{payment.drivers.name}</p>
                          <p className="text-xs text-gray-500">
                            {payment.drivers.driver_number}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        {payment.tours ? (
                          <div>
                            <p className="font-medium">
                              {payment.tours.booking_ref}
                            </p>
                            <p className="text-xs text-gray-500">
                              {payment.tours.client_name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="py-4 font-mono font-medium">
                        ${parseFloat(payment.amount.toString()).toFixed(2)}
                      </td>
                      <td className="py-4">
                        <Badge
                          variant={
                            payment.status === "paid" ? "default" : "secondary"
                          }
                          className={
                            payment.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm">
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-4 text-sm">{payment.notes || "-"}</td>
                      <td className="py-4">
                        {payment.status === "pending" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-2"
                            onClick={() => handleMarkAsPaid(payment)}
                          >
                            <Check className="h-4 w-4" />
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPayments.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  No payments found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
