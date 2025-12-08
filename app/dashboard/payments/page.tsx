"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  Search,
  Check,
  DollarSign,
  Eye,
  Edit,
  Trash,
} from "lucide-react";

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
import { currencyList, thousandSeparator } from "@/lib/utils";
import DataTable from "@/components/ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

// Interfaces
interface DriverPayment {
  driver_number: string;
  updated_at: string;
  currency: string;
  paid_amount: string | number;
  driver_name: string;
  customer_name: string;
  id: string;
  driver_id: string;
  tour_id: string;
  amount: number | string;
  tobe_paid: number | string;
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
  customer_name: string;
  amount: number | string;
  currency: string;
  agent: string;
  agent_ref: string;
  status: string;
  created_at: string;
  updated_at: string;
  // payment_date: string | null;
  // created_at: string;
  // tours: {
  //   booking_ref: string;
  //   client_name: string;
  // };
}

interface Driver {
  id: string;
  driver_id: string;
  name: string;
  driver_number: string;
}

interface Tour {
  id: string;
  booking_ref: string;
  client_name: string;
  amount: string;
  paid_amount: string;
  currency: string;
  value: string;
  label: string;
  status: string;
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
  const [driverPayment, setDriverPayment] = useState<DriverPayment | null>(
    null
  );
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  // Tour data
  const [tourPayments, setTourPayments] = useState<TourPayment[]>([]);
  const [tourPayment, setTourPayment] = useState<TourPayment | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);

  // Shared state
  const [searchDriver, setSearchDriver] = useState("");
  const [searchTour, setSearchTour] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [viewDriverMode, setViewDriverMode] = useState(false);
  const [viewTourMode, setViewTourMode] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [formDriverData, setFormDriverData] = useState({
    id: "",
    driver_id: "",
    driver_name: "",
    customer_name: "",
    tour_id: "",
    amount: 0,
    tobe_paid: 0,
    currency: "",
    paid_amount: 0,
    status: "",
  });

  const [formTourData, setFormTourData] = useState({
    id: "",
    tour_id: "",
    amount: 0,
    currency: "",
    status: "",
    customer_name: "",
    agent: "",
    agent_ref: "",
  });

  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

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

  const [rates, setRates] = useState<{ [key: string]: number }>({});

  const [selectedRange, setSelectedRange] = useState(() => {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear();
    return {
      startMonth: `${year}-${month}`,
      endMonth: `${year}-${month}`,
    };
  });

  const [summary, setSummary] = useState({} as any);

  useEffect(() => {
    resetForm();
  }, [activeTab]);

  useEffect(() => {
    fetchTourPayments();
  }, [selectedAgents, pageTour, pageSizeTour]);

  useEffect(() => {
    fetchDriverPayments();
  }, [pageDriver, pageSizeDriver]);

  // Fetch initial data
  useEffect(() => {
    fetchDrivers();
    fetchTours();
    fetchSummary();
    fetchRates();
  }, []);

  useEffect(() => {
    fetchTourPayments();
  }, [searchTour]);

  useEffect(() => {
    fetchDriverPayments();
  }, [searchDriver]);

  useEffect(() => {
    fetchSummary();
  }, [selectedRange]);

  // -------------------------
  // FETCH FUNCTIONS
  // -------------------------

  async function fetchRates() {
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/LKR");
      const data = await res.json();
      setRates(data.rates); // data.rates is an object with currency codes
    } catch (err) {
      console.error("Failed to fetch rates:", err);
    }
  }

  // Convert any amount to LKR
  function toLKR(amount: number, currency: string) {
    if (currency === "LKR") return amount;
    if (!rates[currency]) return 0;
    return amount / rates[currency]; // because base is LKR
  }

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
          // agent: selectedAgents.length > 0 ? selectedAgents : [],
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

  async function fetchSummary() {
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${createpayments}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startMonth: selectedRange.startMonth,
          endMonth: selectedRange.endMonth,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setSummary(res.summary || {});
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
        response = await fetch(`${createpayments}/${formDriverData?.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paid_amount: Number(formDriverData.tobe_paid),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        // await logActivity("create", "driver_payment", null, formData);
        fetchDriverPayments(); // <-- only for driver tab
      } else {
        // TOUR PAYMENT
        response = await fetch(`${createpayments}/${formTourData?.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "Confirmed",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        // await logActivity("create", "tour_payment", null, formData);
        fetchTourPayments();
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
  // RESET FORM
  // -------------------------
  function resetForm() {
    setFormDriverData({
      id: "",
      driver_id: "",
      driver_name: "",
      customer_name: "",
      tour_id: "",
      amount: 0,
      tobe_paid: 0,
      currency: "",
      paid_amount: 0,
      status: "",
    });
    setFormTourData({
      id: "",
      tour_id: "",
      amount: 0,
      currency: "",
      status: "",
      customer_name: "",
      agent: "",
      agent_ref: "",
    });
  }

  // -------------------------
  // TOTALS
  // -------------------------

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Assigned":
        return "bg-blue-100 text-blue-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      case "Confirmed":
        return "bg-green-100 text-green-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const agentsList = [
    "EL",
    "IW",
    "TF",
    "IT",
    "OW",
    "BF",
    "CT",
    "BW",
    "MT",
    "MZ",
    "TX",
    "DR",
  ];

  function toggleAgent(agent: string) {
    setSelectedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  }
  const tourcolumns = [
    {
      key: "tour_id",
      label: "Trip ID",
    },
    {
      key: "customer_name",
      label: "Customer Name",
    },
    {
      key: "agent",
      label: "Agent",
    },
    {
      key: "agent_ref",
      label: "Agent Ref",
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: Tour) => `${thousandSeparator(row.amount)} ${row.currency}`,
    },
    {
      key: "created_at",
      label: "Payment Date",
    },
    {
      key: "status",
      label: "Status",
      render: (row: Tour) => (
        <Badge className={getStatusColor(row.status)}>{row.status}</Badge>
      ),
    },
  ];

  const drivercolumns = [
    {
      key: "driver_name",
      label: "Driver",
    },
    {
      key: "tour_id",
      label: "Trip ID",
    },
    {
      key: "amount",
      label: "Total Amount",
      render: (row: Tour) => `${thousandSeparator(row.amount)} ${row.currency}`,
    },
    {
      key: "paid_amount",
      label: "Paid Amount",
      render: (row: Tour) =>
        `${thousandSeparator(row.paid_amount)} ${row.currency}`,
    },
    {
      key: "created_at",
      label: "Payment Date",
    },
    {
      key: "status",
      label: "Status",
      render: (row: Tour) => (
        <Badge className={getStatusColor(row.status)}>{row.status}</Badge>
      ),
    },
  ];
  function handleEdit(type: string, obj: TourPayment | DriverPayment) {
    if (type === "driver") {
      const driver = obj as DriverPayment;

      setDriverPayment(driver);

      setFormDriverData({
        id: driver.id,
        driver_id: driver.driver_id,
        tour_id: driver.tour_id,
        driver_name: driver.driver_name,
        customer_name: driver.customer_name,
        amount: Number(driver.amount),
        tobe_paid: Number(driver.tobe_paid),
        currency: driver.currency,
        paid_amount: Number(driver.paid_amount),
        status: driver.status,
      });

      setDialogOpen(true);
    } else {
      const trip = obj as TourPayment;

      setTourPayment(trip);

      setFormTourData({
        id: trip.id,
        tour_id: trip.tour_id,
        amount: Number(trip.amount),
        currency: trip.currency,
        status: trip.status,
        customer_name: trip.customer_name,
        agent: trip.agent,
        agent_ref: trip.agent_ref,
      });
      setDialogOpen(true);
    }
  }

  function handleView(type: String, obj: TourPayment | DriverPayment) {
    if (type == "driver") {
      setViewDriverMode(true);
      setDriverPayment(obj as DriverPayment);
    } else {
      setViewTourMode(true);
      setTourPayment(obj as TourPayment);
    }
  }

  function handleStartMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newStart = e.target.value;

    setSelectedRange((prev) => {
      // if end < start → adjust end = start
      const adjustedEnd = prev.endMonth < newStart ? newStart : prev.endMonth;

      return {
        startMonth: newStart,
        endMonth: adjustedEnd,
      };
    });
  }

  function handleEndMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newEnd = e.target.value;

    setSelectedRange((prev) => {
      // enforce: end >= start
      if (newEnd < prev.startMonth) {
        return {
          ...prev,
          endMonth: prev.startMonth, // auto-fix
        };
      }
      return { ...prev, endMonth: newEnd };
    });
  }

  // -------------------------
  // MAIN RENDER
  // -------------------------

  return (
    <DashboardLayout>
      {/* Stats */}
      <div className="mb-4 flex gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">
            Start Month:
          </label>
          <input
            type="month"
            value={selectedRange.startMonth}
            onChange={handleStartMonthChange}
            className="border px-2 py-1 rounded"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">
            End Month:
          </label>
          <input
            type="month"
            value={selectedRange.endMonth}
            onChange={handleEndMonthChange}
            className="border px-2 py-1 rounded"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Received Amount
            </CardTitle>
            <DollarSign className="h-5 w-5 text-orange-600" />
          </CardHeader>

          <CardContent>
            {/* Currency totals */}
            <div className="text-lg font-semibold">
              {"රු"} {thousandSeparator(summary.tour_payments?.LKR)}{" "}
              <span className="text-xs text-gray-500 ml-1">({"LKR"})</span>
            </div>
            <div className="text-lg font-semibold">
              {"$"} {thousandSeparator(summary.tour_payments?.USD)}{" "}
              <span className="text-xs text-gray-500 ml-1">({"USD"})</span>
            </div>
            <div className="text-lg font-semibold">
              {"€"} {thousandSeparator(summary.tour_payments?.EUR)}{" "}
              <span className="text-xs text-gray-500 ml-1">({"EURO"})</span>
            </div>
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
              රු{thousandSeparator(summary.driver_payments?.LKR)}
            </div>
            {/* <p className="text-xs text-gray-500 mt-1">
              {driverPayments.filter((p) => p.status === "paid").length}{" "}
              completed
            </p> */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Balance
            </CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/**
               * Balance = Total Tour Payments (all currencies converted to LKR)
               *           - Total Driver Payments (all currencies converted to LKR)
               */}
              රු
              {
                // Sum of tour payments in LKR
                thousandSeparator(
                  toLKR(summary.tour_payments?.LKR || 0, "LKR") +
                    toLKR(summary.tour_payments?.USD || 0, "USD") +
                    toLKR(summary.tour_payments?.EUR || 0, "EUR") -
                    // Minus sum of driver payments in LKR
                    (toLKR(summary.driver_payments?.LKR || 0, "LKR") +
                      toLKR(summary.driver_payments?.USD || 0, "USD") +
                      toLKR(summary.driver_payments?.EUR || 0, "EUR"))
                )
              }
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="driver">Driver Payments</TabsTrigger>
            <TabsTrigger value="tour">Trip Payments</TabsTrigger>
          </TabsList>

          {/* ================================
              DRIVER PAYMENTS
          ================================= */}
          <TabsContent value="driver">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Update Driver Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label className="text-gray-500">Driver</Label>
                      <p className="font-medium">{`${formDriverData.driver_id} - ${formDriverData.driver_name}`}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Trip</Label>
                      <p className="font-medium">{`${formDriverData.tour_id} - ${formDriverData.customer_name}`}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Amount</Label>
                      <p className="font-medium">{`${thousandSeparator(
                        formDriverData.amount
                      )} ${formDriverData.currency}`}</p>
                    </div>
                    {(Number(formDriverData?.amount) ?? 0) -
                      (Number(formDriverData?.paid_amount) ?? 0) >
                      0 && (
                      <>
                        <div>
                          <Label className="text-gray-500">To be Paid</Label>
                          <p className="font-medium">
                            {`${thousandSeparator(
                              Number(formDriverData.amount) -
                                Number(formDriverData.paid_amount)
                            )} ${formDriverData.currency}`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tobe_paid">Payment Amount</Label>
                          <Input
                            id="tobe_paid"
                            value={formDriverData.tobe_paid || ""}
                            onChange={(e) =>
                              setFormDriverData({
                                ...formDriverData,
                                tobe_paid:
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Update</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table */}

            <DataTable
              columns={drivercolumns}
              data={filteredDrivers}
              searchValue={searchDriver}
              onSearchChange={setSearchDriver}
              pagination={paginationDriver}
              pageSize={pageSizeDriver}
              onPageChange={setPageDriver}
              onPageSizeChange={(size) => {
                setPageSizeDriver(size);
                setPageDriver(1);
              }}
              renderActions={(driver: DriverPayment) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleView("driver", driver)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {driver?.status != "Completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit("driver", driver)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}

                  {/* <Button
                    size="sm"
                    variant="ghost"
                    // onClick={() => handleDelete(driver.id)}
                  >
                    <Trash className="h-4 w-4 text-red-500" />
                  </Button> */}
                </div>
              )}
            />

            <Dialog open={viewDriverMode} onOpenChange={setViewDriverMode}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {" "}
                    <span>Payment Details</span>
                  </DialogTitle>
                </DialogHeader>
                {driverPayment && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-gray-500">Driver ID</Label>
                        <p className="font-medium">{driverPayment.driver_id}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Driver Name</Label>
                        <p className="font-medium">
                          {driverPayment.driver_name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Driver Number</Label>
                        <p className="font-medium">
                          {driverPayment.driver_number}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Total Amount</Label>
                        <p className="font-medium">
                          {`${thousandSeparator(driverPayment.amount)} ${
                            driverPayment.currency
                          }`}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Paid Amount</Label>
                        <p className="font-medium">
                          {`${thousandSeparator(driverPayment.paid_amount)} ${
                            driverPayment.currency
                          }`}
                        </p>
                      </div>
                      {(Number(driverPayment?.amount) ?? 0) -
                        (Number(driverPayment?.paid_amount) ?? 0) >
                        0 && (
                        <div>
                          <Label className="text-gray-500">To be Paid</Label>
                          <p className="font-medium">
                            {`${thousandSeparator(
                              Number(driverPayment.amount) -
                                Number(driverPayment.paid_amount)
                            )} ${driverPayment.currency}`}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label className="text-gray-500">Status</Label>
                        <p className="font-medium">{driverPayment.status}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">
                          Created Date-Time
                        </Label>
                        <p className="font-medium">
                          {driverPayment.created_at}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">
                          Update Date-Time
                        </Label>
                        <p className="font-medium">
                          {driverPayment.updated_at}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ==================================
              TOUR PAYMENTS
          ================================== */}
          <TabsContent value="tour">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Update Trip Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-gray-500">Trip ID</Label>
                        <p className="font-medium">{formTourData.tour_id}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Customer Name</Label>
                        <p className="font-medium">
                          {formTourData.customer_name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Agent</Label>
                        <p className="font-medium">{formTourData.agent}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Agent Reference</Label>
                        <p className="font-medium">{formTourData.agent_ref}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Amount</Label>
                        <p className="font-medium">
                          {`${thousandSeparator(formTourData.amount)} ${
                            formTourData.currency
                          }`}
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-500">
                          Confirmation Status
                        </Label>
                        <p className="font-medium">{formTourData.status}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Update</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-100 justify-between">
                  Filter by Agents
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56 p-2 max-h-64 overflow-y-auto space-y-1">
                {/* Clear All Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mb-2"
                  disabled={selectedAgents.length === 0}
                  onClick={() => setSelectedAgents([])}
                >
                  Clear All
                </Button>

                {/* Agents List */}
                {agentsList.map((agent) => (
                  <div
                    key={agent}
                    className="flex items-center space-x-2 p-1 cursor-pointer"
                    onClick={() => toggleAgent(agent)}
                  >
                    <Checkbox
                      checked={selectedAgents.includes(agent)}
                      onCheckedChange={() => toggleAgent(agent)}
                    />
                    <span>{agent}</span>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DataTable
              columns={tourcolumns}
              data={filteredTours}
              searchValue={searchTour}
              onSearchChange={setSearchTour}
              pagination={paginationTour}
              pageSize={pageSizeTour}
              onPageChange={setPageTour}
              onPageSizeChange={(size) => {
                setPageSizeTour(size);
                setPageTour(1);
              }}
              renderActions={(tour: TourPayment) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleView("tour", tour)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {tour?.status != "Completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit("tour", tour)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}

                  {/* <Button
                    size="sm"
                    variant="ghost"
                    // onClick={() => handleDelete(tour.id)}
                  >
                    <Trash className="h-4 w-4 text-red-500" />
                  </Button> */}
                </div>
              )}
            />

            <Dialog open={viewTourMode} onOpenChange={setViewTourMode}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {" "}
                    <span>Payment Details</span>
                  </DialogTitle>
                </DialogHeader>
                {tourPayment && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-gray-500">Trip ID</Label>
                        <p className="font-medium">{tourPayment.tour_id}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Customer Name</Label>
                        <p className="font-medium">
                          {tourPayment.customer_name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Agent</Label>
                        <p className="font-medium">{tourPayment.agent}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Agent Reference</Label>
                        <p className="font-medium">{tourPayment.agent_ref}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Amount</Label>
                        <p className="font-medium">
                          {`${thousandSeparator(tourPayment.amount)} ${
                            tourPayment.currency
                          }`}
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-500">
                          Confirmation Status
                        </Label>
                        <p className="font-medium">{tourPayment.status}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">
                          Created Date-Time
                        </Label>
                        <p className="font-medium">{tourPayment.created_at}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">
                          Update Date-Time
                        </Label>
                        <p className="font-medium">{tourPayment.updated_at}</p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
