'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, Search, Edit, AlertCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activity-logger';
import { Textarea } from '@/components/ui/textarea';

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
}

interface Complaint {
  id: string;
  complaint_text: string;
  status: string;
  created_at: string;
  tour_id: string | null;
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [tours, setTours] = useState<TourAssignment[]>([]);
  const { profile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    languages: '',
    vehicle_type: '',
    vehicle_plate: '',
    status: 'active',
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    const filtered = drivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(search.toLowerCase()) ||
        driver.driver_number.toLowerCase().includes(search.toLowerCase()) ||
        driver.vehicle_plate.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredDrivers(filtered);
  }, [search, drivers]);

  async function fetchDrivers() {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
      setFilteredDrivers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchDriverDetails(driverId: string) {
    try {
      const [complaintsRes, toursRes] = await Promise.all([
        supabase
          .from('complaints')
          .select('*')
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false }),
        supabase
          .from('tours')
          .select('id, booking_ref, client_name, status, arrival_datetime')
          .eq('assigned_driver_id', driverId)
          .order('arrival_datetime', { ascending: false })
          .limit(10),
      ]);

      setComplaints(complaintsRes.data || []);
      setTours(toursRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch driver details',
        variant: 'destructive',
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const languagesArray = formData.languages
        .split(',')
        .map((lang) => lang.trim())
        .filter((lang) => lang);

      if (selectedDriver) {
        const { error } = await supabase
          .from('drivers')
          .update({
            name: formData.name,
            languages: languagesArray,
            vehicle_type: formData.vehicle_type,
            vehicle_plate: formData.vehicle_plate,
            status: formData.status,
          })
          .eq('id', selectedDriver.id);

        if (error) throw error;

        await logActivity('update', 'drivers', selectedDriver.id, {
          old: selectedDriver,
          new: formData,
        });

        toast({
          title: 'Success',
          description: 'Driver updated successfully',
        });
      } else {
        const { data: driverNumber } = await supabase.rpc('generate_driver_number');

        const { error } = await supabase.from('drivers').insert({
          driver_number: driverNumber,
          name: formData.name,
          languages: languagesArray,
          vehicle_type: formData.vehicle_type,
          vehicle_plate: formData.vehicle_plate,
          status: formData.status,
          created_by: profile?.id,
        });

        if (error) throw error;

        await logActivity('create', 'drivers', null, formData);

        toast({
          title: 'Success',
          description: 'Driver registered successfully',
        });
      }

      fetchDrivers();
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      languages: '',
      vehicle_type: '',
      vehicle_plate: '',
      status: 'active',
    });
    setSelectedDriver(null);
  }

  function handleEdit(driver: Driver) {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      languages: driver.languages.join(', '),
      vehicle_type: driver.vehicle_type,
      vehicle_plate: driver.vehicle_plate,
      status: driver.status,
    });
    setDialogOpen(true);
  }

  function handleViewDetails(driver: Driver) {
    setSelectedDriver(driver);
    fetchDriverDetails(driver.id);
    setDetailsOpen(true);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Drivers Management</h1>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Register Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedDriver ? 'Edit Driver' : 'Register New Driver'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">Languages (comma-separated)</Label>
                    <Input
                      id="languages"
                      placeholder="English, Spanish, French"
                      value={formData.languages}
                      onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">Vehicle Type</Label>
                    <Select
                      value={formData.vehicle_type}
                      onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
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
                        setFormData({ ...formData, vehicle_plate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
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
                    {selectedDriver ? 'Update' : 'Register'} Driver
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
                  placeholder="Search by name, number, or plate..."
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
                    <th className="pb-3 font-medium">Driver #</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Languages</th>
                    <th className="pb-3 font-medium">Vehicle</th>
                    <th className="pb-3 font-medium">Plate</th>
                    <th className="pb-3 font-medium">Rides</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="border-b last:border-0">
                      <td className="py-4 font-mono text-sm">{driver.driver_number}</td>
                      <td className="py-4 font-medium">{driver.name}</td>
                      <td className="py-4 text-sm">{driver.languages.join(', ')}</td>
                      <td className="py-4 text-sm">{driver.vehicle_type}</td>
                      <td className="py-4 font-mono text-sm">{driver.vehicle_plate}</td>
                      <td className="py-4 text-sm">{driver.number_of_rides}</td>
                      <td className="py-4">
                        <Badge
                          variant={driver.status === 'active' ? 'default' : 'secondary'}
                        >
                          {driver.status}
                        </Badge>
                      </td>
                      <td className="py-4">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDrivers.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  No drivers found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Driver Details: {selectedDriver?.name}</DialogTitle>
          </DialogHeader>
          {selectedDriver && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">Driver Number</Label>
                  <p className="font-mono font-medium">{selectedDriver.driver_number}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Vehicle</Label>
                  <p className="font-medium">
                    {selectedDriver.vehicle_type} - {selectedDriver.vehicle_plate}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Languages</Label>
                  <p className="font-medium">{selectedDriver.languages.join(', ')}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Total Rides</Label>
                  <p className="font-medium">{selectedDriver.number_of_rides}</p>
                </div>
              </div>

              <div>
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
                          <p className="text-sm text-gray-500">{tour.client_name}</p>
                        </div>
                        <Badge>{tour.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Complaints
                </h3>
                <div className="space-y-2">
                  {complaints.length === 0 ? (
                    <p className="text-sm text-gray-500">No complaints registered</p>
                  ) : (
                    complaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="rounded-lg border p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <Badge>{complaint.status}</Badge>
                          <p className="text-xs text-gray-500">
                            {new Date(complaint.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm">{complaint.complaint_text}</p>
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
