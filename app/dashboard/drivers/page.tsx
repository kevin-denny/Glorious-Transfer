"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Plus, Search, Edit, AlertCircle, Eye, Trash } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity-logger";
import Swal from "sweetalert2";
import DataTable from "@/components/ui/DataTable";

interface Driver {
  id: string;
  driver_number: string;
  name: string;
  languages: string[];
  vehicle_type: string;
  vehicle_plate: string;
  number_of_rides: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Complaint {
  tour_id: string;
  complaint: string;
}

interface TourAssignment {
  id: string;
  booking_ref: string;
  client_name: string;
  status: string;
  arrival_datetime: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [tours, setTours] = useState<TourAssignment[]>([]);
  const { profile } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // For all drivers
  const getdrivers = `${baseUrl}/api/drivers`;
  // update driver
  const drivercall = `${baseUrl}/api/drivers`;
  // create driver
  const createdriver = `${baseUrl}/api/drivers/register`;
  const [formData, setFormData] = useState({
    name: "",
    languages: "",
    vehicle_type: "",
    vehicle_plate: "",
    driver_number: "",
    status: "active",
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
      fetchDrivers();
    }
  }, [page, pageSize, token, profile]);

  useEffect(() => {
    // const filtered = drivers.filter(
    //   (driver) =>
    //     driver.name.toLowerCase().includes(search.toLowerCase()) ||
    //     driver.id.includes(search) ||
    //     driver.vehicle_plate.includes(search)
    // );
    // setFilteredDrivers(filtered);
    fetchDrivers();
  }, [search]);

  async function fetchDrivers() {
    if (!token || !profile) {
      console.log("Skipping fetchDrivers - no auth");
      return;
    }
    setLoading(true);
    try {

      const response = await fetch(`${getdrivers}`, {
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

      setDrivers(res.data || []);
      setFilteredDrivers(res.data || []);

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

  async function fetchDriverDetails(driverId: string) {
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${getdrivers}/complaints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driver_id: driverId,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();

      setComplaints(res.complaints || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch driver details",
        variant: "destructive",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const languagesArray = formData.languages
        .split(",")
        .map((lang) => lang.trim())
        .filter((lang) => lang);

      let response: Response;

      if (selectedDriver) {
        // Update driver
        response = await fetch(`${drivercall}/${selectedDriver.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            languages: languagesArray,
            vehicle_type: formData.vehicle_type,
            vehicle_plate: formData.vehicle_plate,
            driver_number: formData.driver_number,
            status: formData.status,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("update", "drivers", selectedDriver.id, {
          old: selectedDriver,
          new: formData,
        });

        toast({
          title: "Success",
          description: "Driver updated successfully",
        });
      } else {
        // Create new driver
        response = await fetch(drivercall, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            languages: languagesArray,
            vehicle_type: formData.vehicle_type,
            vehicle_plate: formData.vehicle_plate,
            status: formData.status,
            driver_number: formData.driver_number,
            created_by: profile?.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        await logActivity("create", "drivers", null, formData);

        toast({
          title: "Success",
          description: "Driver registered successfully",
        });
      }

      resetForm();
      fetchDrivers();
      setDialogOpen(false);
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
      name: "",
      languages: "",
      vehicle_type: "",
      vehicle_plate: "",
      driver_number: "",
      status: "",
    });
    setSelectedDriver(null);
  }

  function handleEdit(driver: Driver) {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      languages: driver.languages.join(", "),
      vehicle_type: driver.vehicle_type,
      vehicle_plate: driver.vehicle_plate,
      driver_number: driver.driver_number,
      status: driver.status,
    });
    setDialogOpen(true);
  }

  function handleViewDetails(driver: Driver) {
    setSelectedDriver(driver);
    fetchDriverDetails(driver.id);
    setDetailsOpen(true);
  }

  async function handleDelete(driverId: string) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you really want to delete this driver?",
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
      const response = await fetch(`${drivercall}/${driverId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete driver`);
      }

      await Swal.fire({
        title: "Deleted!",
        text: "Driver deleted successfully.",
        icon: "success",
        confirmButtonColor: "#3085d6",
      });

      // Refresh drivers list
      fetchDrivers();
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
      label: "Driver #",
    },
    {
      key: "name",
      label: "Name",
    },
    {
      key: "languages",
      label: "Languages",
      render: (row: Driver) => row.languages.join(", "),
    },
    {
      key: "vehicle_type",
      label: "Vehicle",
    },
    {
      key: "vehicle_plate",
      label: "Plate",
    },
    {
      key: "number_of_rides",
      label: "Rides",
    },
    {
      key: "status",
      label: "Status",
      render: (row: Driver) => (
        <Badge variant={row.status === "Active" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            Drivers Management
          </h1>
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
                Register Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedDriver ? "Edit Driver" : "Register New Driver"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">
                      Languages (comma-separated)
                    </Label>
                    <Input
                      id="languages"
                      placeholder="English, Spanish, French"
                      value={formData.languages}
                      onChange={(e) =>
                        setFormData({ ...formData, languages: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">Vehicle Type</Label>
                    <Select
                      value={formData.vehicle_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, vehicle_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sedan">Sedan</SelectItem>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="Van">Van</SelectItem>
                        <SelectItem value="Bus">Bus</SelectItem>
                        <SelectItem value="Luxury">Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_plate">Vehicle Plate</Label>
                    <Input
                      id="vehicle_plate"
                      value={formData.vehicle_plate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vehicle_plate: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_number">Phone Number</Label>
                    <Input
                      id="driver_number"
                      value={formData.driver_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          driver_number: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
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
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    {selectedDriver ? "Update" : "Register"} Driver
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <DataTable
          columns={columns}
          data={filteredDrivers}
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by Driver ID, Name, Plate Number, Status"
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          renderActions={(driver: Driver) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewDetails(driver)}
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(driver)}
              >
                <Edit className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(driver.id)}
              >
                <Trash className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        />
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Driver Details: {selectedDriver?.name} | {selectedDriver?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedDriver && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Contact Number</Label>
                  <p className="font-mono font-medium">
                    {selectedDriver.driver_number}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Vehicle</Label>
                  <p className="font-medium">
                    {selectedDriver.vehicle_type} -{" "}
                    {selectedDriver.vehicle_plate}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Languages</Label>
                  <p className="font-medium">
                    {selectedDriver.languages.join(", ")}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <p className="font-medium">{selectedDriver.status}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Created Time</Label>
                  <p className="font-medium">{selectedDriver.created_at}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Last Updated Time</Label>
                  <p className="font-medium">{selectedDriver.updated_at}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Total Rides</Label>
                  <p className="font-medium">
                    {selectedDriver.number_of_rides}
                  </p>
                </div>
              </div>

              {/* <div>
                <h3 className="mb-3 font-semibold text-lg">Assigned Tours</h3>
                <div className="space-y-2">
                  {tours.length === 0 ? (
                    <p className="text-sm text-gray-500">No tours assigned</p>
                  ) : (
                    tours.map((tour) => (
                      <div
                        key={tour.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{tour.booking_ref}</p>
                          <p className="text-sm text-gray-500">
                            {tour.client_name}
                          </p>
                        </div>
                        <Badge>{tour.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div> */}

              <div>
                <h3 className="mb-3 font-semibold text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Complaints
                </h3>

                <div
                  className={`space-y-2 ${
                    complaints.length > 3 ? "max-h-64 overflow-y-auto pr-2" : ""
                  }`}
                >
                  {complaints.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No complaints registered
                    </p>
                  ) : (
                    complaints.map((complaint) => (
                      <div
                        key={complaint.tour_id}
                        className="rounded-lg border p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {complaint.tour_id}
                          </p>
                        </div>
                        <p className="text-sm">{complaint.complaint}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
