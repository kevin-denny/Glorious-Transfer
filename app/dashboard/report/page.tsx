"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { agentsList, thousandSeparator } from "@/lib/utils";
import DataTable from "@/components/ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import Swal from "sweetalert2";
import { Search } from "lucide-react";

// Interfaces
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
  income_amount: string;
  paid_amount: string;
  currency: string;
  value: string;
  label: string;
  status: string;
  payment_status: string;
}

export default function PaymentsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // gettourdropdown
  const getreports = `https://${baseUrl}/api/report`;

  const [driverId, setDriverId] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState("driver");

  // Driver data
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  // Tour data
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);

  // Shared state
  const [loading, setLoading] = useState(true);

  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
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

  useEffect(() => {
    // Set token from localStorage after component mounts
    setToken(localStorage.getItem("auth_token"));
  }, []);

  useEffect(() => {
    resetForm();
  }, [activeTab]);

  // Fetch initial data
  useEffect(() => {
    if (selectedStatus?.length > 0 && token && profile) {
      fetchDrivers();
    }
  }, [selectedRange, selectedStatus, pageDriver, pageSizeDriver, token, profile]);

  useEffect(() => {
    if (selectedAgents?.length > 0 && token && profile) {
      fetchTours();
    }
  }, [selectedRange, selectedAgents, pageTour, pageSizeTour, token, profile]);

  useEffect(() => {
    if ((download == true || downloadAll == true) && token && profile) {
      if (activeTab == "driver") {
        fetchDrivers();
      } else {
        fetchTours();
      }
    }
  }, [download, downloadAll, token, profile]);

  // -------------------------
  // FETCH FUNCTIONS
  // -------------------------

  async function fetchDrivers() {
    if (!token || !profile) {
      console.log("Skipping fetchDrivers - no auth");
      return;
    }
    setLoading(true);
    try {

      const response = await fetch(`${getreports}/driver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: selectedRange.startDate,
          endDate: selectedRange.endDate,
          status: selectedStatus,
          download: download,
          driverId: driverId,
          downloadAll: downloadAll,
          page: pageTour,
          pageSize: pageSizeTour,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const contentType = response.headers.get("content-type") || "";

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

        return;
      }

      const json = await response.json();

      setDrivers(json.data || []);
      setFilteredDrivers(json.data || []);

      // Save pagination
      setPaginationDriver(json.pagination);
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

  const handleDriverSearch = () => {
    // if (!driverId.trim()) return;
    if (!selectedStatus || selectedStatus.length === 0) return;

    fetchDrivers();
  };

  const handleDriverKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // if (!driverId.trim()) return;
      if (!selectedStatus || selectedStatus.length === 0) return;

      fetchDrivers();
    }
  };

  async function fetchTours() {
    if (!token || !profile) {
      console.log("Skipping fetchTours - no auth");
      return;
    }
    setLoading(true);
    try {

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

  // -------------------------
  // RESET FORM
  // -------------------------
  function resetForm() {
    setDrivers([]);
    setFilteredDrivers([]);
    setTours([]);
    setFilteredTours([]);
    setDownload(false);
    setDownloadAll(false);
    setSelectedAgents([]);
    setSelectedStatus([]);
    setSelectedRange(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");

      return {
        startDate: `${year}-${month}-${day}`,
        endDate: `${year}-${month}-${day}`,
      };
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

  function toggleAgent(agent: string) {
    setSelectedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  }

  const statusList = ["Pending", "Partial", "Completed"];

  function toggleStatus(status: string) {
    setSelectedStatus((prev) =>
      prev.includes(status)
        ? prev.filter((a) => a !== status)
        : [...prev, status]
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
      key: "driverId",
      label: "Driver ID",
    },
    {
      key: "driver",
      label: "Driver",
    },
    {
      key: "trip_id",
      label: "Trip ID",
    },
    {
      key: "agent_id",
      label: "Agent ID",
    },
    {
      key: "agent_ref",
      label: "Agent Ref",
    },
    {
      key: "pickup_datetime",
      label: "Pickup Date",
    },
    {
      key: "pick_up",
      label: "Pickup",
    },
    {
      key: "drop_off",
      label: "Drop off",
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
      key: "payment_status",
      label: "Status",
      render: (row: Tour) => (
        <Badge className={getStatusColor(row.payment_status)}>
          {row.payment_status}
        </Badge>
      ),
    },
  ];

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
            <TabsTrigger value="tour">Agent Report</TabsTrigger>
          </TabsList>

          {/* ================================
              DRIVER PAYMENTS
          ================================= */}
          <TabsContent value="driver">
            {/* Table */}
            <div className="mb-4 flex flex-wrap gap-4 items-end">
              {/* Start Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">
                  Start Date:
                </label>
                <input
                  type="date"
                  value={selectedRange.startDate}
                  onChange={handleStartMonthChange}
                  className="border px-2 rounded h-9"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">
                  End Date:
                </label>
                <input
                  type="date"
                  value={selectedRange.endDate}
                  onChange={handleEndMonthChange}
                  className="border px-2 rounded h-9"
                />
              </div>

              {/* Status Filter */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 justify-between">
                    Filter by Status
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-56 p-2 max-h-64 overflow-y-auto space-y-1">
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8"
                      disabled={selectedStatus.length === 0}
                      onClick={() => setSelectedStatus([])}
                    >
                      Clear All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8"
                      disabled={selectedStatus.length === statusList.length}
                      onClick={() => setSelectedStatus([...statusList])}
                    >
                      Select All
                    </Button>
                  </div>

                  {statusList.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => toggleStatus(status)}
                    >
                      <Checkbox checked={selectedStatus.includes(status)} />
                      <span>{status}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Driver ID Search */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    onKeyDown={handleDriverKeyDown}
                    placeholder="Enter Driver ID"
                    className="border px-2 pr-9 rounded h-9"
                  />
                  <button
                    type="button"
                    onClick={handleDriverSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={selectedStatus.length === 0}
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "Do you really want to download?",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, Download!",
                      cancelButtonText: "Cancel",
                      buttonsStyling: false,
                    });

                    if (!result.isConfirmed) return;
                    setDownload(true);
                  }}
                >
                  Download
                </Button>

                <Button
                  variant="outline"
                  className="h-9"
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "Do you really want to download all?",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, Download!",
                      cancelButtonText: "Cancel",
                      buttonsStyling: false,
                    });

                    if (!result.isConfirmed) return;
                    setDownloadAll(true);
                  }}
                >
                  Download All
                </Button>
              </div>
            </div>

            <DataTable
              columns={drivercolumns}
              data={filteredDrivers}
              pagination={paginationDriver}
              pageSize={pageSizeDriver}
              onPageChange={setPageDriver}
              onPageSizeChange={(size) => {
                setPageSizeDriver(size);
                setPageDriver(1);
              }}
              // renderActions={(driver: DriverPayment) => (
              //   <div className="flex gap-2">
              //     <Button
              //       size="sm"
              //       variant="ghost"
              //       onClick={() => handleView("driver", driver)}
              //     >
              //       <Eye className="h-4 w-4" />
              //     </Button>
              //     {driver?.status != "Completed" && (
              //       <Button
              //         size="sm"
              //         variant="ghost"
              //         onClick={() => handleEdit("driver", driver)}
              //       >
              //         <Edit className="h-4 w-4" />
              //       </Button>
              //     )}

              //     {/* <Button
              //       size="sm"
              //       variant="ghost"
              //       // onClick={() => handleDelete(driver.id)}
              //     >
              //       <Trash className="h-4 w-4 text-red-500" />
              //     </Button> */}
              //   </div>
              // )}
            />
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
                    <DropdownMenuItem
                      key={agent}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => toggleAgent(agent)}
                    >
                      <Checkbox checked={selectedAgents.includes(agent)} />
                      <span>{agent}</span>
                    </DropdownMenuItem>

                    // <div
                    //   key={agent}
                    //   className="flex items-center space-x-2 p-1 cursor-pointer"
                    //   onClick={() => toggleAgent(agent)}
                    // >
                    //   <Checkbox
                    //     checked={selectedAgents.includes(agent)}
                    //     onCheckedChange={() => toggleAgent(agent)}
                    //   />
                    //   <span>{agent}</span>
                    // </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "Do you really want to download?",
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
