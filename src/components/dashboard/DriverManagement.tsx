import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Driver {
  id: string;
  driver_number: string;
  name: string;
  languages: string[];
  vehicle_type: string;
  vehicle_plate: string;
  number_of_rides: number;
  complaints: string[];
}

const DriverManagement = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    languages: '',
    vehicle_type: '',
    vehicle_plate: '',
  });
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

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
      entity_type: 'driver',
      entity_id: entityId,
      details,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const languages = formData.languages.split(',').map(l => l.trim()).filter(l => l);
    const driverData: any = {
      name: formData.name,
      languages,
      vehicle_type: formData.vehicle_type,
      vehicle_plate: formData.vehicle_plate,
      created_by: user?.id,
    };

    if (editingDriver) {
      const { error } = await supabase
        .from('drivers')
        .update(driverData)
        .eq('id', editingDriver.id);

      if (error) {
        toast({ title: 'Error updating driver', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Driver updated successfully' });
        await logActivity('UPDATE', editingDriver.id, driverData);
        fetchDrivers();
        resetForm();
      }
    } else {
      const { data, error } = await supabase
        .from('drivers')
        .insert([driverData])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating driver', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Driver created successfully', description: `Driver number: ${data.driver_number}` });
        await logActivity('CREATE', data.id, driverData);
        fetchDrivers();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete driver ${name}?`)) return;

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error deleting driver', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Driver deleted successfully' });
      await logActivity('DELETE', id, { name });
      fetchDrivers();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', languages: '', vehicle_type: '', vehicle_plate: '' });
    setEditingDriver(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      languages: driver.languages.join(', '),
      vehicle_type: driver.vehicle_type,
      vehicle_plate: driver.vehicle_plate,
    });
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Driver Management</CardTitle>
            <CardDescription>Register and manage tour drivers</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
                  <DialogDescription>
                    {editingDriver ? 'Update driver information' : 'Driver number will be auto-generated'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
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
                    <Input
                      id="vehicle_type"
                      placeholder="Sedan, SUV, Van"
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_plate">Vehicle Plate</Label>
                    <Input
                      id="vehicle_plate"
                      placeholder="ABC-1234"
                      value={formData.vehicle_plate}
                      onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingDriver ? 'Update' : 'Create'} Driver
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
                <TableHead>Driver #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Rides</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No drivers registered yet
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.driver_number}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {driver.languages.map((lang, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{driver.vehicle_type}</TableCell>
                    <TableCell>{driver.vehicle_plate}</TableCell>
                    <TableCell>{driver.number_of_rides}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(driver)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(driver.id, driver.name)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </Card>
  );
};

export default DriverManagement;
