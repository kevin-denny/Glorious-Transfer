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
  Edit,
  UserPlus,
  Eye,
  Trash,
  Clipboard,
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity-logger";
import DataTable from "@/components/ui/DataTable";
import Swal from "sweetalert2";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  agentsList,
  currencyList,
  formatDateTime,
  vehicletypedata,
} from "@/lib/utils";

interface Tour {
  id: string;
  booking_date: string;
  // booking_ref: string;
  customer_name: string;
  category: string;
  agent: string;
  agent_ref: string;
  pax: number;
  contact_details: string;
  currency: string;
  amount: string;
  pickup_datetime: string;
  arrival_datetime: string;
  departure_datetime: string;
  pickup: string | null;
  destination: string | null;
  flight_no: string | null;
  remarks: string | null;
  complaints: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_driver_id: string | null;
  driver_id: string | null;
  vehicle_type: string | null;
  assignment?: {
    driver: Driver;
    phone: string;
    driver_number: string;
    vehicle_number: string;
  } | null;
}
interface Assign {
  selectedDriver: string;
  amount: string;
  currency: string;
}

interface Driver {
  driver_id: string;
  name: string;
  driver_number: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  id: string | null;
}

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [selectedDriver, setSelectedDriver] = useState({});
  const [viewMode, setViewMode] = useState(false);

  const { profile } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // For all tours
  const gettours = `${baseUrl}/api/tours`;
  // create tour
  const createtour = `${baseUrl}/api/tours/create`;
  // create tour
  const activedrivers = `${baseUrl}/api/assign/drivers`;
  // assign driver
  const assigndrivers = `${baseUrl}/api/assign`;

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

  const [formData, setFormData] = useState({
    booking_date: new Date().toISOString().split("T")[0],
    customer_name: "",
    category: "",
    agent: "",
    agent_ref: "",
    pax: 1,
    contact_details: "",
    amount: "",
    currency: "LKR",
    pickup_datetime: "",
    arrival_datetime: "",
    departure_datetime: "",
    pickup: "",
    destination: "",
    flight_no: "",
    remarks: "",
    complaints: "",
    driver_id: "",
    vehicle_type: "",
    status: "Pending",
  });

  const [assignData, setAssignData] = useState({
    selectedDriver: "",
    amount: "",
    paid_amount: "",
    currency: "LKR",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    // Set token from localStorage after component mounts
    setToken(localStorage.getItem("auth_token"));
  }, []);

  useEffect(() => {
    if (token && profile) {
      fetchTours();
    }
  }, [selectedRange, page, pageSize, token, profile]);

  useEffect(() => {
    if (token && profile) {
      fetchDrivers();
    }
  }, [token]);

  useEffect(() => {
    // const filtered = tours.filter(
    //   (tour) =>
    //     // tour.booking_ref.toLowerCase().includes(search.toLowerCase()) ||
    //     tour.customer_name.includes(search) || tour.agent.includes(search)
    // );
    // setFilteredTours(filtered);
    if (token && profile) {
      fetchTours();
    }
  }, [search, token, profile]);

  async function fetchTours() {
    if (!token || !profile) {
      console.log("Skipping fetchTours - no auth");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${gettours}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: selectedRange.startDate,
          endDate: selectedRange.endDate,
          searchTerm: search,
          page: page,
          pageSize: pageSize,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setTours(res.data || []);
      setFilteredTours(res.data || []);

      // Save pagination info
      setPagination(res.pagination);
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
      if (!token || !profile) {
        console.log("Skipping fetchDrivers - no auth");
        return;
      }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !profile) {
      console.log("Skipping handleSubmit - no auth");
      return;
    }
    setLoading(true);
    try {
      let response: Response;
      if (selectedTour) {
        const result = await Swal.fire({
          title: "Are you sure?",
          text: "Do you really want to update this tour?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, update it!",
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

        response = await fetch(`${gettours}/${selectedTour.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            booking_date: formData.booking_date,
            customer_name: formData.customer_name,
            category: formData.category,
            agent: formData.agent,
            agent_ref: formData.agent_ref,
            pax: formData.pax,
            contact_details: formData.contact_details,
            pickup_datetime: formData.pickup_datetime,
            arrival_datetime: formData.arrival_datetime,
            currency: formData.currency,
            amount: formData.amount,
            pickup: formData.pickup,
            destination: formData.destination,
            departure_datetime: formData.departure_datetime,
            flight_no: formData.flight_no,
            remarks: formData.remarks,
            complaints: formData.complaints,
            vehicle_type: formData.vehicle_type,
            status: formData.status,
            driver_id: formData?.driver_id,
            created_by: profile?.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("update", "tours", selectedTour.id, {
          old: selectedTour,
          new: formData,
        });

        toast({
          title: "Success",
          description: "Trip updated successfully",
        });
      } else {
        // Create new driver
        response = await fetch(createtour, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            booking_date: formData.booking_date,
            customer_name: formData.customer_name,
            category: formData.category,
            agent: formData.agent,
            agent_ref: formData.agent_ref,
            pax: formData.pax,
            contact_details: formData.contact_details,
            pickup_datetime: formData.pickup_datetime,
            arrival_datetime: formData.arrival_datetime,
            currency: formData.currency,
            amount: formData.amount,
            pickup: formData.pickup,
            destination: formData.destination,
            departure_datetime: formData.departure_datetime,
            flight_no: formData.flight_no,
            remarks: formData.remarks,
            status: formData.status,
            vehicle_type: formData.vehicle_type,
            created_by: profile?.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("create", "tours", null, formData);

        toast({
          title: "Success",
          description: "Trip created successfully",
        });
      }

      fetchTours();
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

  async function handleAssignDriver() {
    if (!selectedTour) return;
    if (!token || !profile) {
      console.log("Skipping handleAssignDriver - no auth");
      return;
    }

    setLoading(true);
    try {
      let response: Response;
      response = await fetch(assigndrivers, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tour_id: selectedTour.id,
          driver_id: assignData?.selectedDriver,
          amount: assignData?.amount,
          paid_amount: assignData?.paid_amount,
          currency: assignData?.currency,
        }),
      });

      // await logActivity("update", "tours", selectedTour.id, {
      //   action: "assigned_driver",
      //   driver_id: driverId,
      // });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }
      toast({
        title: "Success",
        description: "Driver Assigned successfully",
      });

      fetchTours();
      setAssignDialogOpen(false);
      setSelectedTour(null);
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
      booking_date: new Date().toISOString().split("T")[0],
      customer_name: "",
      category: "",
      agent: "",
      agent_ref: "",
      pax: 1,
      contact_details: "",
      amount: "",
      currency: "LKR",
      pickup_datetime: "",
      arrival_datetime: "",
      pickup: "",
      destination: "",
      departure_datetime: "",
      flight_no: "",
      remarks: "",
      complaints: "",
      driver_id: "",
      vehicle_type: "",
      status: "Pending",
    });
    setSelectedTour(null);
    setAssignData({
      selectedDriver: "",
      amount: "",
      paid_amount: "",
      currency: "LKR",
    });
  }

  function handleEdit(tour: Tour) {
    setSelectedTour(tour);
    setFormData({
      booking_date: tour.booking_date,
      customer_name: tour.customer_name,
      category: tour.category,
      agent: tour.agent,
      agent_ref: tour.agent_ref,
      pax: tour.pax,
      contact_details: tour.contact_details,
      amount: tour.amount,
      currency: tour.currency,
      pickup_datetime: tour.pickup_datetime,
      arrival_datetime: tour.arrival_datetime,
      departure_datetime: tour.departure_datetime,
      pickup: tour.pickup || "",
      destination: tour.destination || "",
      flight_no: tour.flight_no || "",
      remarks: tour.remarks || "",
      complaints: tour.complaints || "",
      status: tour.status,
      vehicle_type: tour?.vehicle_type || "",
      driver_id: tour?.assignment?.driver?.id || "",
    });
    setDialogOpen(true);
    setAssignData({
      selectedDriver: "",
      amount: "",
      paid_amount: "",
      currency: "LKR",
    });
  }

  function handleView(tour: Tour) {
    setViewMode(true);
    setSelectedTour(tour);
  }

  function openAssignDialog(tour: Tour) {
    setSelectedTour(tour);
    setAssignDialogOpen(true);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Assigned":
        return "bg-blue-100 text-blue-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you really want to delete this tour?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "swal-confirm-btn",
        cancelButton: "swal-cancel-btn",
        popup:
          "dark:bg-[hsl(var(--background))] dark:text-[hsl(var(--foreground))]",
      },
      buttonsStyling: false, // we’ll style it ourselves
      background: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
    });

    if (!result.isConfirmed) return;

    if (!token || !profile) {
      console.log("Skipping handleDelete - no auth");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${gettours}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete tour`);
      }

      await Swal.fire({
        title: "Deleted!",
        text: "Trip deleted successfully.",
        icon: "success",
        confirmButtonColor: "#3085d6",
      });

      // Refresh drivers list
      fetchTours();
    } catch (error: any) {
      Swal.fire({
        title: "Error!",
        text: error.message,
        icon: "error",
        confirmButtonColor: "#3085d6",
      });
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    {
      key: "id",
      label: "Booking Ref #",
    },
    {
      key: "pickup_datetime",
      label: "Pickup Date-Time",
      render: (row: Tour) => `${formatDateTime(row.pickup_datetime)}`,
    },
    {
      key: "pickup",
      label: "Pickup",
    },
    {
      key: "destination",
      label: "Drop off",
    },
    {
      key: "customer_name",
      label: "Client",
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
      key: "vehicle_type",
      label: "Vehicle Type",
    },
    {
      key: "drivers_name",
      label: "Driver",
      render: (row: Tour) => (
        <>
          {row.assignment ? (
            <div>
              <p className="font-medium">{row.assignment.driver.name}</p>
              <p className="text-xs text-gray-500">
                {row.assignment.driver.vehicle_type}
              </p>
            </div>
          ) : (
            <span className="text-gray-400">Not Assigned</span>
          )}
        </>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: Tour) => (
        <Badge className={getStatusColor(row.status)}>{row.status}</Badge>
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Trips Management</h1>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (selectedTour) setSelectedTour(null);
              if (!open) resetForm();
            }}
          >
            {profile?.role != "finance" && (
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Trip
                </Button>
              </DialogTrigger>
            )}

            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTour ? "Edit Trip" : "Create New Trip"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="booking_date">Booking Date</Label>
                    <Input
                      id="booking_date"
                      type="date"
                      value={formData.booking_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          booking_date: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Client Name</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent">Agent</Label>
                    <Select
                      value={formData.agent}
                      onValueChange={(value) =>
                        setFormData({ ...formData, agent: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentsList.map((agent) => (
                          <SelectItem key={agent} value={agent}>
                            {agent}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent_ref">Agent Reference</Label>
                    <Input
                      id="agent_ref"
                      value={formData.agent_ref}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          agent_ref: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Trip Type</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Trip Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arrival">Arrival</SelectItem>
                        <SelectItem value="Departure">Departure</SelectItem>
                        <SelectItem value="Round Tour">Round Tour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pax">Number of Passengers</Label>
                    <Input
                      id="pax"
                      type="number"
                      min="1"
                      value={formData.pax}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pax: parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">Vehicle Type</Label>
                    <Select
                      value={formData.vehicle_type}
                      onValueChange={(v) =>
                        setFormData({ ...formData, vehicle_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vehicle Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicletypedata.map((vehicle) => (
                          <SelectItem key={vehicle} value={vehicle}>
                            {vehicle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_details">Contact Details</Label>
                    <Input
                      id="contact_details"
                      value={formData.contact_details}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_details: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Income Amount</Label>
                    <Input
                      id="amount"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: e.target.value,
                        })
                      }
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
                  {formData?.category == "Round Tour" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="arrival_datetime">
                          Arrival Date & Time
                        </Label>
                        <Input
                          id="arrival_datetime"
                          type="datetime-local"
                          value={formData.arrival_datetime}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              arrival_datetime: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="departure_datetime">
                          Departure Date & Time
                        </Label>
                        <Input
                          id="departure_datetime"
                          type="datetime-local"
                          value={formData.departure_datetime}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              departure_datetime: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {(formData?.category == "Departure" ||
                    formData?.category == "Arrival") && (
                    <div className="space-y-2">
                      <Label htmlFor="pickup_datetime">
                        Pickup Date & Time
                      </Label>
                      <Input
                        id="pickup_datetime"
                        type="datetime-local"
                        value={formData.pickup_datetime}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pickup_datetime: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="flight_no">Flight Number</Label>
                    <Input
                      id="flight_no"
                      value={formData.flight_no}
                      onChange={(e) =>
                        setFormData({ ...formData, flight_no: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickup">Pickup</Label>
                    <Input
                      id="pickup"
                      value={formData.pickup}
                      onChange={(e) =>
                        setFormData({ ...formData, pickup: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Drop off</Label>
                    <Input
                      id="destination"
                      value={formData.destination}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          destination: e.target.value,
                        })
                      }
                    />
                  </div>

                  {selectedTour && (
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedTour.status == "Assigned" && (
                            <SelectItem value="Completed">Completed</SelectItem>
                          )}
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                {formData?.status != "Pending" && (
                  <div className="space-y-2">
                    <Label htmlFor="complaints">Complaints</Label>
                    <Textarea
                      id="complaints"
                      value={formData.complaints}
                      maxLength={60}
                      onChange={(e) =>
                        setFormData({ ...formData, complaints: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                )}

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
                    {selectedTour ? "Update" : "Create"} Trip
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
        </div>
        <DataTable
          columns={columns}
          data={filteredTours}
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by Bookin Ref, Client, Agent, Agent Ref, Status"
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          renderActions={(tour: Tour) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleView(tour)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {profile?.role != "finance" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(tour)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(tour.id)}
                  >
                    <Trash className="h-4 w-4 text-red-500" />
                  </Button>
                  {tour.status === "Pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAssignDialog(tour)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        />
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Driver to Trip</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTour && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Trip Details</p>
                <p className="text-sm">
                  {selectedTour.id} | {selectedTour.customer_name}
                </p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Driver dropdown */}
              <div className="space-y-2">
                <Label>Select Driver</Label>

                <Select
                  onValueChange={(v) =>
                    setAssignData({ ...assignData, selectedDriver: v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>

                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem
                        key={driver.driver_id}
                        value={String(driver.driver_id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{driver.name}</span>
                          <span className="text-xs text-gray-500">
                            {driver.driver_number}
                          </span>
                        </div>
                      </SelectItem>
                    ))}

                    {drivers.length === 0 && (
                      <div className="p-2 text-sm text-gray-500">
                        No active drivers available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Total Amount</Label>
                <Input
                  id="amount"
                  value={assignData.amount}
                  onChange={(e) =>
                    setAssignData({
                      ...assignData,
                      amount: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_amount">Paid Amount</Label>
                <Input
                  id="paid_amount"
                  value={assignData.paid_amount}
                  onChange={(e) =>
                    setAssignData({
                      ...assignData,
                      paid_amount: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={assignData.currency}
                  onValueChange={(v) =>
                    setAssignData({ ...assignData, currency: v })
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
            {/* OK Button */}
            <div className="flex justify-end pt-4">
              <Button
                // disabled={!selectedDriver}
                onClick={() => {
                  handleAssignDriver();
                  setAssignDialogOpen(false);
                }}
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewMode} onOpenChange={setViewMode}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Trip Details: {selectedTour?.id}</span>

              {selectedTour?.status === "Assigned" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                  onClick={() => {
                    const textToCopy = `
                    Hello from Glorious Transfer!
We have received your booking for transport and please review the transfer date and time below and let us know if everything is correct. 
Thank you!

BOOKING DETAILS

Pick Up Date-Time: ${
                      selectedTour.pickup_datetime
                        ? formatDateTime(selectedTour.pickup_datetime)
                        : ""
                    }
Pickup: ${selectedTour.pickup ?? ""}
Drop off: ${selectedTour.destination ?? ""}
Remarks: ${selectedTour.remarks ?? ""}

DRIVER DETAILS

Driver Name: ${
                      selectedTour.assignment
                        ? selectedTour.assignment.driver.name
                        : ""
                    }
Driver Contact: ${
                      selectedTour.assignment
                        ? selectedTour.assignment.driver.phone
                        : ""
                    }
Vehicle: ${
                      selectedTour.assignment
                        ? selectedTour.assignment.driver.vehicle_type
                        : ""
                    }
Vehicle Number: ${
                      selectedTour.assignment
                        ? selectedTour.assignment.driver.vehicle_number
                        : ""
                    }

Attention:
1. Please connect free WiFi at the CMB airport & notify us on WhatsApp once you land.

2. Follow the map to go to the meeting point.
        `.trim();

                    navigator.clipboard.writeText(textToCopy).then(() => {
                      toast({
                        title: "Copied!",
                        description: "Trip details copied to clipboard.",
                      });
                    });
                  }}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTour && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Booking Date</Label>
                  <p className="font-medium">
                    {formatDateTime(selectedTour.booking_date)}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Customer Name</Label>
                  <p className="font-medium">{selectedTour.customer_name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Agent</Label>
                  <p className="font-medium">{selectedTour.agent}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Agent Reference</Label>
                  <p className="font-medium">{selectedTour.agent_ref}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Trip Type</Label>
                  <p className="font-medium">{selectedTour.category}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Pax</Label>
                  <p className="font-medium">{selectedTour.pax}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Contact Details</Label>
                  <p className="font-medium">{selectedTour.contact_details}</p>
                </div>
                {selectedTour?.category == "Round Tour" && (
                  <>
                    <div>
                      <Label className="text-gray-500">Arrival Date-Time</Label>
                      <p className="font-medium">
                        {formatDateTime(selectedTour.arrival_datetime)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-500">
                        Departure Date-Time
                      </Label>
                      <p className="font-medium">
                        {formatDateTime(selectedTour.departure_datetime)}
                      </p>
                    </div>
                  </>
                )}
                {(selectedTour?.category == "Departure" ||
                  selectedTour?.category == "Arrival") && (
                  <div>
                    <Label className="text-gray-500">Pickup Date & Time</Label>
                    <p className="font-medium">
                      {formatDateTime(selectedTour.pickup_datetime)}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-gray-500">Flight Number</Label>
                  <p className="font-medium">{selectedTour.flight_no}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Pickup</Label>
                  <p className="font-medium">{selectedTour.pickup}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Drop off</Label>
                  <p className="font-medium">{selectedTour.destination}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <p className="font-medium">{selectedTour.status}</p>
                </div>
                {selectedTour?.assignment && (
                  <div>
                    <div className="flex items-center gap-1">
                      <Label className="text-gray-500">Driver</Label>

                      {/* Copy Driver Details Button */}
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                const driver = selectedTour.assignment?.driver;
                                const textToCopy = `
To Driver Copy

PASSENGER DETAILS

Customer Name: ${selectedTour.customer_name}
Pax: ${selectedTour.pax}
Contact Details: ${selectedTour.contact_details}
Flight Number: ${selectedTour.flight_no ?? ""}
Pick Up Date-Time: ${
                                  selectedTour.pickup_datetime
                                    ? formatDateTime(
                                        selectedTour.pickup_datetime
                                      )
                                    : ""
                                }
Pickup: ${selectedTour.pickup ?? ""}
Drop off: ${selectedTour.destination ?? ""}
Remarks:${selectedTour.remarks ?? ""}

Ride Amount: ${selectedTour.amount} ${selectedTour.currency}
          `.trim();

                                navigator.clipboard
                                  .writeText(textToCopy)
                                  .then(() => {
                                    toast({
                                      title: "Copied!",
                                      description:
                                        "Driver details copied to clipboard.",
                                    });
                                  });
                              }}
                            >
                              <Clipboard className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>

                          <TooltipContent>Copy Driver Details</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <p className="font-medium">
                      {selectedTour.assignment.driver?.name}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-gray-500">Remarks</Label>
                  <p className="font-medium">{selectedTour.remarks}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Complaints</Label>
                  <p className="font-medium">{selectedTour.complaints}</p>
                </div>

                <div>
                  <Label className="text-gray-500">Created Time</Label>
                  <p className="font-medium">
                    {formatDateTime(selectedTour.created_at)}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Last Updated Time</Label>
                  <p className="font-medium">
                    {formatDateTime(selectedTour.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
