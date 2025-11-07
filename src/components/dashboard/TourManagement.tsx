import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, UserPlus } from 'lucide-react';

interface Tour {
  id: string;
  booking_ref: string;
  booking_date: string;
  customer_name: string;
  agent: string;
  pax: number;
  contact_details: string;
  arrival_datetime: string;
  departure_datetime: string;
  flight_no: string | null;
  flight_time: string | null;
  remarks: string | null;
  driver_id: string | null;
  status: string;
  drivers?: { name: string } | null;
}

interface Driver {
  id: string;
  name: string;
  driver_number: string;
}

const TourManagement = () => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [formData, setFormData] = useState({
    booking_date: '',
    booking_ref: '',
    customer_name: '',
    agent: '',
    pax: '1',
    contact_details: '',
    arrival_datetime: '',
    departure_datetime: '',
    flight_no: '',
    flight_time: '',
    remarks: '',
  });
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchTours();
    fetchDrivers();
  }, []);

  const fetchTours = async () => {
    const { data, error } = await supabase
      .from('tours')
      .select('*, drivers(name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching tours', description: error.message, variant: 'destructive' });
    } else {
      setTours(data || []);
    }
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, driver_number')
      .order('name');

    if (error) {
      toast({ title: 'Error fetching drivers', description: error.message, variant: 'destructive' });
    } else {
      setDrivers(data || []);
    }
  };

  const logActivity = async (action: string, entityId: string, details: any) => {
    if (!user || !profile) return;
    
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile.full_name,
      user_role: profile.role,
      action,
      entity_type: 'tour',
      entity_id: entityId,
      details,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const tourData = {
      booking_date: formData.booking_date,
      booking_ref: formData.booking_ref,
      customer_name: formData.customer_name,
      agent: formData.agent,
      pax: parseInt(formData.pax),
      contact_details: formData.contact_details,
      arrival_datetime: formData.arrival_datetime,
      departure_datetime: formData.departure_datetime,
      flight_no: formData.flight_no || null,
      flight_time: formData.flight_time || null,
      remarks: formData.remarks || null,
      created_by: user?.id,
    };

    if (editingTour) {
      const { error } = await supabase
        .from('tours')
        .update(tourData)
        .eq('id', editingTour.id);

      if (error) {
        toast({ title: 'Error updating tour', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Tour updated successfully' });
        await logActivity('UPDATE', editingTour.id, tourData);
        fetchTours();
        resetForm();
      }
    } else {
      const { data, error } = await supabase
        .from('tours')
        .insert([tourData])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating tour', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Tour created successfully', description: `Booking ref: ${data.booking_ref}` });
        await logActivity('CREATE', data.id, tourData);
        fetchTours();
        resetForm();
      }
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedTour || !selectedDriverId) return;

    const { error } = await supabase
      .from('tours')
      .update({ 
        driver_id: selectedDriverId,
        assigned_at: new Date().toISOString(),
        status: 'assigned'
      })
      .eq('id', selectedTour.id);

    if (error) {
      toast({ title: 'Error assigning driver', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Driver assigned successfully' });
      await logActivity('ASSIGN_DRIVER', selectedTour.id, { driver_id: selectedDriverId });
      fetchTours();
      setAssignDialogOpen(false);
      setSelectedTour(null);
      setSelectedDriverId('');
    }
  };

  const resetForm = () => {
    setFormData({
      booking_date: '',
      booking_ref: '',
      customer_name: '',
      agent: '',
      pax: '1',
      contact_details: '',
      arrival_datetime: '',
      departure_datetime: '',
      flight_no: '',
      flight_time: '',
      remarks: '',
    });
    setEditingTour(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (tour: Tour) => {
    setEditingTour(tour);
    setFormData({
      booking_date: tour.booking_date,
      booking_ref: tour.booking_ref,
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax.toString(),
      contact_details: tour.contact_details,
      arrival_datetime: tour.arrival_datetime.replace('Z', ''),
      departure_datetime: tour.departure_datetime.replace('Z', ''),
      flight_no: tour.flight_no || '',
      flight_time: tour.flight_time || '',
      remarks: tour.remarks || '',
    });
    setIsDialogOpen(true);
  };

  const openAssignDialog = (tour: Tour) => {
    setSelectedTour(tour);
    setSelectedDriverId(tour.driver_id || '');
    setAssignDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tour Management</CardTitle>
            <CardDescription>Manage bookings and assign drivers</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tour
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingTour ? 'Edit Tour' : 'Add New Tour'}</DialogTitle>
                  <DialogDescription>Enter tour booking details</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="booking_date">Booking Date</Label>
                      <Input
                        id="booking_date"
                        type="date"
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking_ref">Booking Reference</Label>
                      <Input
                        id="booking_ref"
                        value={formData.booking_ref}
                        onChange={(e) => setFormData({ ...formData, booking_ref: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="agent">Agent</Label>
                      <Input
                        id="agent"
                        value={formData.agent}
                        onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pax">Passengers (PAX)</Label>
                      <Input
                        id="pax"
                        type="number"
                        min="1"
                        value={formData.pax}
                        onChange={(e) => setFormData({ ...formData, pax: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_details">Contact Details</Label>
                    <Input
                      id="contact_details"
                      value={formData.contact_details}
                      onChange={(e) => setFormData({ ...formData, contact_details: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="arrival_datetime">Arrival Date & Time</Label>
                      <Input
                        id="arrival_datetime"
                        type="datetime-local"
                        value={formData.arrival_datetime}
                        onChange={(e) => setFormData({ ...formData, arrival_datetime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departure_datetime">Departure Date & Time</Label>
                      <Input
                        id="departure_datetime"
                        type="datetime-local"
                        value={formData.departure_datetime}
                        onChange={(e) => setFormData({ ...formData, departure_datetime: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="flight_no">Flight Number</Label>
                      <Input
                        id="flight_no"
                        value={formData.flight_no}
                        onChange={(e) => setFormData({ ...formData, flight_no: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flight_time">Flight Time</Label>
                      <Input
                        id="flight_time"
                        type="time"
                        value={formData.flight_time}
                        onChange={(e) => setFormData({ ...formData, flight_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Input
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTour ? 'Update' : 'Create'} Tour
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>PAX</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tours.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No tours scheduled yet
                  </TableCell>
                </TableRow>
              ) : (
                tours.map((tour) => (
                  <TableRow key={tour.id}>
                    <TableCell className="font-medium">{tour.booking_ref}</TableCell>
                    <TableCell>{tour.customer_name}</TableCell>
                    <TableCell>{tour.agent}</TableCell>
                    <TableCell>{tour.pax}</TableCell>
                    <TableCell>{new Date(tour.arrival_datetime).toLocaleDateString()}</TableCell>
                    <TableCell>{tour.drivers?.name || 'Unassigned'}</TableCell>
                    <TableCell>
                      <Badge variant={tour.status === 'assigned' ? 'default' : 'secondary'}>
                        {tour.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(tour)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openAssignDialog(tour)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
            <DialogDescription>
              Select a driver for {selectedTour?.customer_name}'s tour
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} ({driver.driver_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignDriver} disabled={!selectedDriverId}>
              Assign Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TourManagement;
