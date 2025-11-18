"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Plus, Search, Edit, UserPlus } from "lucide-react";
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

interface Tour {
  id: string;
  booking_date: string;
  booking_ref: string;
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
  assigned_driver_id: string | null;
  drivers?: { name: string; driver_number: string } | null;
}

interface Driver {
  id: string;
  name: string;
  driver_number: string;
  status: string;
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
  const [viewMode, setViewMode] = useState(false);

  const { profile } = useAuth();
  const { toast } = useToast();

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // create tour
  const createtour = `http://${baseUrl}/api/tours/create`;

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
    status: "pending",
  });

  useEffect(() => {
    fetchTours();
    fetchDrivers();
  }, []);

  useEffect(() => {
    const filtered = tours.filter(
      (tour) =>
        tour.booking_ref.toLowerCase().includes(search.toLowerCase()) ||
        tour.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        tour.agent.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredTours(filtered);
  }, [search, tours]);

  async function fetchTours() {
    try {
      // const { data, error } = await supabase
      //   .from('tours')
      //   .select(`
      //     *,
      //     drivers:assigned_driver_id (name, driver_number)
      //   `)
      //   .order('booking_date', { ascending: false });

      // if (error) throw error;
      // setTours(data || []);
      // setFilteredTours(data || []);
      setTours([]);
      setFilteredTours([]);
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
      //   .select('id, name, driver_number, status')
      //   .eq('status', 'active')
      //   .order('name');

      // if (error) throw error;
      // setDrivers(data || []);
      setDrivers([]);
    } catch (error: any) {
      console.error("Error fetching drivers:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No auth token found");
      let response: Response;
      if (selectedTour) {
        // const { error } = await supabase
        //   .from('tours')
        //   .update(formData)
        //   .eq('id', selectedTour.id);

        // if (error) throw error;

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

  async function handleAssignDriver(driverId: string) {
    if (!selectedTour) return;

    setLoading(true);
    try {
      // const { error } = await supabase
      //   .from('tours')
      //   .update({
      //     assigned_driver_id: driverId,
      //     status: 'assigned',
      //   })
      //   .eq('id', selectedTour.id);

      // if (error) throw error;

      // const { error: updateError } = await supabase.rpc('increment', {
      //   row_id: driverId,
      //   table_name: 'drivers',
      //   column_name: 'number_of_rides',
      // });

      await logActivity("update", "tours", selectedTour.id, {
        action: "assigned_driver",
        driver_id: driverId,
      });

      toast({
        title: "Success",
        description: "Driver assigned successfully",
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
      status: "pending",
    });
    setSelectedTour(null);
  }

  function handleEdit(tour: Tour) {
    setViewMode(false);
    setSelectedTour(tour);
    setFormData({
      booking_date: tour.booking_date,
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax,
      contact_details: tour.contact_details,
      arrival_datetime: tour.arrival_datetime.slice(0, 16),
      departure_datetime: tour.departure_datetime.slice(0, 16),
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
    handleEdit(tour);
  }

  function openAssignDialog(tour: Tour) {
    setSelectedTour(tour);
    setAssignDialogOpen(true);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by booking ref, client, or agent..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Booking Ref</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Agent</th>
                    <th className="pb-3 font-medium">Pax</th>
                    <th className="pb-3 font-medium">Arrival</th>
                    <th className="pb-3 font-medium">Driver</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTours.map((tour) => (
                    <tr key={tour.id} className="border-b last:border-0">
                      <td className="py-4 font-mono text-sm">
                        {tour.booking_ref}
                      </td>
                      <td className="py-4 font-medium">{tour.customer_name}</td>
                      <td className="py-4 text-sm">{tour.agent}</td>
                      <td className="py-4 text-sm">{tour.pax}</td>
                      <td className="py-4 text-sm">
                        {new Date(tour.arrival_datetime).toLocaleString()}
                      </td>
                      <td className="py-4 text-sm">
                        {tour.drivers ? (
                          <div>
                            <p className="font-medium">{tour.drivers.name}</p>
                            <p className="text-xs text-gray-500">
                              {tour.drivers.driver_number}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not assigned</span>
                        )}
                      </td>
                      <td className="py-4">
                        <Badge className={getStatusColor(tour.status)}>
                          {tour.status}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(tour)}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(tour)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {tour.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAssignDialog(tour)}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTours.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  No tours found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
                <p className="font-medium">{selectedTour.booking_ref}</p>
                <p className="text-sm">{selectedTour.customer_name}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Select Driver</Label>
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <p className="font-medium">{driver.name}</p>
                    <p className="text-sm text-gray-500">
                      {driver.driver_number}
                    </p>
                  </button>
                ))}
                {drivers.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No active drivers available
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
