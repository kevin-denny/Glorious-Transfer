"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Plus, Search, Edit, UserPlus, Eye, Trash } from "lucide-react";
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

interface Tour {
  id: string;
  booking_date: string;
  // booking_ref: string;
  customer_name: string;
  agent: string;
  pax: number;
  contact_details: string;
  arrival_datetime: string;
  departure_datetime: string;
  pickup: string | null;
  destination: string | null;
  flight_no: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_driver_id: string | null;
  assignment?: { driver: Driver; driver_number: string } | null;
}

interface Driver {
  driver_id: string;
  name: string;
  driver_number: string;
  vehicle_type: string;
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
  const token = localStorage.getItem("auth_token");

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // For all tours
  const gettours = `http://${baseUrl}/api/tours`;
  // create tour
  const createtour = `http://${baseUrl}/api/tours/create`;
  // create tour
  const activedrivers = `http://${baseUrl}/api/assign/drivers`;
  // assign driver
  const assigndrivers = `http://${baseUrl}/api/assign`;

  const [formData, setFormData] = useState({
    booking_date: new Date().toISOString().split("T")[0],
    customer_name: "",
    agent: "",
    pax: 1,
    contact_details: "",
    arrival_datetime: "",
    departure_datetime: "",
    pickup: "",
    destination: "",
    flight_no: "",
    remarks: "",
    status: "Pending",
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
    fetchTours();
  }, [page, pageSize]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    // const filtered = tours.filter(
    //   (tour) =>
    //     // tour.booking_ref.toLowerCase().includes(search.toLowerCase()) ||
    //     tour.customer_name.includes(search) || tour.agent.includes(search)
    // );
    // setFilteredTours(filtered);
    fetchTours();
  }, [search]);

  async function fetchTours() {
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${gettours}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    //www.linkedin.com/in/kevin-denny-0b332b218/
    https: console.log("Cool", selectedTour);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No auth token found");
      let response: Response;
      if (selectedTour) {
        response = await fetch(`${gettours}/${selectedTour.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            booking_date: formData.booking_date,
            customer_name: formData.customer_name,
            agent: formData.agent,
            pax: formData.pax,
            contact_details: formData.contact_details,
            arrival_datetime: formData.arrival_datetime,
            pickup: formData.pickup,
            destination: formData.destination,
            departure_datetime: formData.departure_datetime,
            flight_no: formData.flight_no,
            remarks: formData.remarks,
            status: formData.status,
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
          description: "Tour updated successfully",
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
            agent: formData.agent,
            pax: formData.pax,
            contact_details: formData.contact_details,
            arrival_datetime: formData.arrival_datetime,
            pickup: formData.pickup,
            destination: formData.destination,
            departure_datetime: formData.departure_datetime,
            flight_no: formData.flight_no,
            remarks: formData.remarks,
            status: formData.status,
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
          description: "Tour created successfully",
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

  async function handleAssignDriver(driver: string) {
    if (!selectedTour) return;

    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");
      let response: Response;
      response = await fetch(assigndrivers, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tour_id: selectedTour.id,
          driver_id: driver,
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
      agent: "",
      pax: 1,
      contact_details: "",
      arrival_datetime: "",
      pickup: "",
      destination: "",
      departure_datetime: "",
      flight_no: "",
      remarks: "",
      status: "Pending",
    });
    setSelectedTour(null);
  }

  function handleEdit(tour: Tour) {
    setSelectedTour(tour);
    setFormData({
      booking_date: tour.booking_date,
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax,
      contact_details: tour.contact_details,
      arrival_datetime: tour.arrival_datetime,
      departure_datetime: tour.departure_datetime,
      pickup: tour.pickup || "",
      destination: tour.destination || "",
      flight_no: tour.flight_no || "",
      remarks: tour.remarks || "",
      status: tour.status,
    });
    setDialogOpen(true);
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
        text: "Tour deleted successfully.",
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
      key: "customer_name",
      label: "Client",
    },

    {
      key: "agent",
      label: "Agent",
    },
    {
      key: "pax",
      label: "Pax",
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Tours Management</h1>
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
                Create Tour
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTour ? "Edit Tour" : "Create New Tour"}
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
                        <SelectItem value="EL">EL</SelectItem>
                        <SelectItem value="IW">IW</SelectItem>
                        <SelectItem value="TF">TF</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="OW">OW</SelectItem>
                        <SelectItem value="BF">BF</SelectItem>
                        <SelectItem value="CT">CT</SelectItem>
                        <SelectItem value="BW">BW</SelectItem>
                        <SelectItem value="MT">MT</SelectItem>
                        <SelectItem value="MZ">MZ</SelectItem>
                        <SelectItem value="TX">TX</SelectItem>
                        <SelectItem value="DR">DR</SelectItem>
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
                      required
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
                      required
                    />
                  </div>
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
                    <Label htmlFor="destination">Destination</Label>
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
                    {selectedTour ? "Update" : "Create"} Tour
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <DataTable
          columns={columns}
          data={filteredTours}
          searchValue={search}
          onSearchChange={setSearch}
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
            </div>
          )}
        />
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver to Tour</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTour && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Tour Details</p>
                <p className="text-sm">
                  {selectedTour.id} | {selectedTour.customer_name}
                </p>
              </div>
            )}

            {/* Driver dropdown */}
            <div className="space-y-2">
              <Label>Select Driver</Label>

              <Select onValueChange={(val) => setSelectedDriver(val as any)}>
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

            {/* OK Button */}
            <div className="flex justify-end pt-4">
              <Button
                disabled={!selectedDriver}
                onClick={() => {
                  handleAssignDriver(selectedDriver as any);
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
            <DialogTitle>Tour Details: {selectedTour?.id}</DialogTitle>
          </DialogHeader>
          {selectedTour && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Booking Date</Label>
                  <p className="font-medium">{selectedTour.booking_date}</p>
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
                  <Label className="text-gray-500">Pax</Label>
                  <p className="font-medium">{selectedTour.pax}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Contact Details</Label>
                  <p className="font-medium">{selectedTour.contact_details}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Arrival Date-Time</Label>
                  <p className="font-medium">{selectedTour.arrival_datetime}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Departure Date-Time</Label>
                  <p className="font-medium">
                    {selectedTour.departure_datetime}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Flight Number</Label>
                  <p className="font-medium">{selectedTour.flight_no}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Pickup</Label>
                  <p className="font-medium">{selectedTour.pickup}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Destination</Label>
                  <p className="font-medium">{selectedTour.destination}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <p className="font-medium">{selectedTour.status}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Remarks</Label>
                  <p className="font-medium">{selectedTour.remarks}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Created Time</Label>
                  <p className="font-medium">{selectedTour.created_at}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Last Updated Time</Label>
                  <p className="font-medium">{selectedTour.updated_at}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
