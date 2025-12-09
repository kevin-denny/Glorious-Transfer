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
import Swal from "sweetalert2";

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
  income_amount: string;
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
  const getreports = `http://${baseUrl}/api/report`;
  // get active tour
  const activedrivers = `http://${baseUrl}/api/assign/drivers`;
  // create payments
  const createpayments = `http://${baseUrl}/api/payment`;

  // Tabs
  const [activeTab, setActiveTab] = useState("tour");

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
  const [download, setDownload] = useState(false);
  const [downloadAll, setDownloadAll] = useState(false);

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
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    return {
      startDate: `${year}-${month}-${day}`,
      endDate: `${year}-${month}-${day}`,
    };
  });

  const [summary, setSummary] = useState({} as any);

  useEffect(() => {
    resetForm();
  }, [activeTab]);

  // useEffect(() => {
  //   fetchTourPayments();
  // }, [selectedAgents, pageTour, pageSizeTour]);

  // useEffect(() => {
  //   fetchDriverPayments();
  // }, [pageDriver, pageSizeDriver]);

  // Fetch initial data
  useEffect(() => {
    fetchDrivers();
    // fetchTours();
    // fetchSummary();
    fetchRates();
  }, []);

  useEffect(() => {
    fetchDriverPayments();
  }, [searchDriver]);

  useEffect(() => {
    if (selectedAgents?.length > 0) {
      fetchTours();
    }
  }, [selectedRange, selectedAgents, pageTour, pageSizeTour]);

  useEffect(() => {
    if (download == true || downloadAll == true) {
      fetchTours();
    }
  }, [download, downloadAll]);

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
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${getreports}/tour`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: selectedRange.startDate,
          endDate: selectedRange.endDate,
          agent: selectedAgents,
          download: download,
          downloadAll: downloadAll,
          page: pageTour,
          pageSize: pageSizeTour,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const contentType = response.headers.get("content-type") || "";

      // ============================================================
      //  🔥 1. Handle Excel download ONLY if download flags are true
      // ============================================================
      if (
        (download || downloadAll) &&
        contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        // Extract filename
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "tour_report.xlsx";

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match?.[1]) filename = match[1];
        }

        // Force download
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);

        return; // STOP — no JSON expected
      }

      // ==========================================
      //  🔥 2. Handle JSON result (normal response)
      // ==========================================
      const json = await response.json();

      setTours(json.data || []);
      setFilteredTours(json.data || []);

      // Save pagination
      setPaginationTour(json.pagination);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Reset flags after request
      setDownload(false);
      setDownloadAll(false);
    }
  }

  // async function fetchTours() {
  //   try {
  //     if (!token) throw new Error("No auth token found");

  //     const response = await fetch(`${getreports}/tour`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${token}`,
  //       },
  //       body: JSON.stringify({
  //         startDate: selectedRange.startDate,
  //         endDate: selectedRange.endDate,
  //         agent: selectedAgents,
  //         download: true,
  //         downloadAll: false,
  //       }),
  //     });

  //     if (!response.ok)
  //       throw new Error(`HTTP error! status: ${response.status}`);

  //     const res = await response.json();
  //     console.log("Pool",res.data)
  //     setTours(res.data || []);
  //   } catch (error: any) {
  //     toast({
  //       title: "Error",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   }
  // }

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
      key: "agent",
      label: "Agent",
    },
    {
      key: "pickup_datetime",
      label: "Transfer Date",
    },
    {
      key: "agent_ref",
      label: "Agent Ref",
    },
    {
      key: "trip_id",
      label: "Trip ID",
    },
    {
      key: "category",
      label: "Category",
    },
    {
      key: "passenger_name",
      label: "Customer Name",
    },
    {
      key: "income_amount",
      label: "Amount",
      render: (row: Tour) =>
        `${thousandSeparator(row.income_amount)} ${row.currency}`,
    },
    {
      key: "pick_up",
      label: "Pick up",
    },
    {
      key: "drop_off",
      label: "Drop off",
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
      render: (row: Tour) =>
        `${thousandSeparator(row.income_amount)} ${row.currency}`,
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
      const adjustedEnd = prev.endDate < newStart ? newStart : prev.endDate;

      return {
        startDate: newStart,
        endDate: adjustedEnd,
      };
    });
  }

  function handleEndMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newEnd = e.target.value;

    setSelectedRange((prev) => {
      // enforce: end >= start
      if (newEnd < prev.startDate) {
        return {
          ...prev,
          endDate: prev.startDate, // auto-fix
        };
      }
      return { ...prev, endDate: newEnd };
    });
  }

  // -------------------------
  // MAIN RENDER
  // -------------------------

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="driver">Driver Report</TabsTrigger>
            <TabsTrigger value="tour">Trip Report</TabsTrigger>
          </TabsList>

          {/* ================================
              DRIVER PAYMENTS
          ================================= */}
          <TabsContent value="driver">
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
            {/* Table */}
            <div className="mb-4 flex gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">
                  Start Date:
                </label>
                <input
                  type="date"
                  value={selectedRange.startDate}
                  onChange={handleStartMonthChange}
                  className="border px-2 py-1 rounded"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">
                  End Date:
                </label>
                <input
                  type="date"
                  value={selectedRange.endDate}
                  onChange={handleEndMonthChange}
                  className="border px-2 py-1 rounded"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-100 justify-between">
                    Filter by Agents
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-56 p-2 max-h-64 overflow-y-auto space-y-1">
                  {/* Buttons side by side */}
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={selectedAgents.length === 0}
                      onClick={() => setSelectedAgents([])}
                    >
                      Clear All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={selectedAgents.length === agentsList.length}
                      onClick={() => setSelectedAgents([...agentsList])}
                    >
                      Select All
                    </Button>
                  </div>

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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDownload(true);
                  }}
                  disabled={selectedAgents.length === 0}
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "Do you really want to download all?",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, Download!",
                      cancelButtonText: "Cancel",
                      customClass: {
                        confirmButton: "swal-confirm-btn",
                        cancelButton: "swal-cancel-btn",
                        popup:
                          "dark:bg-[hsl(var(--background))] dark:text-[hsl(var(--foreground))]",
                      },
                      buttonsStyling: false,
                      background: "hsl(var(--background))",
                      color: "hsl(var(--foreground))",
                    });

                    if (!result.isConfirmed) return;

                    // 👍 Now safe to run this
                    setDownloadAll(true);
                  }}
                >
                  Download All
                </Button>
              </div>
            </div>

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
              // renderActions={(tour: TourPayment) => (
              //   <div className="flex gap-2">
              //     <Button
              //       size="sm"
              //       variant="ghost"
              //       onClick={() => handleView("tour", tour)}
              //     >
              //       <Eye className="h-4 w-4" />
              //     </Button>
              //     {tour?.status != "Completed" && (
              //       <Button
              //         size="sm"
              //         variant="ghost"
              //         onClick={() => handleEdit("tour", tour)}
              //       >
              //         <Edit className="h-4 w-4" />
              //       </Button>
              //     )}

              //     {/* <Button
              //       size="sm"
              //       variant="ghost"
              //       // onClick={() => handleDelete(tour.id)}
              //     >
              //       <Trash className="h-4 w-4 text-red-500" />
              //     </Button> */}
              //   </div>
              // )}
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
