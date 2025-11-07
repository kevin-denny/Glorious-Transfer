import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2 } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  drivers: { name: string; driver_number: string } | null;
  tours: { booking_ref: string; customer_name: string } | null;
}

const PaymentManagement = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*, drivers(name, driver_number), tours(booking_ref, customer_name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching payments', description: error.message, variant: 'destructive' });
    } else {
      setPayments(data || []);
    }
  };

  const logActivity = async (action: string, entityId: string, details: any) => {
    if (!user || !profile) return;
    
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile.full_name,
      user_role: profile.role,
      action,
      entity_type: 'payment',
      entity_id: entityId,
      details,
    });
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq('id', payment.id);

    if (error) {
      toast({ title: 'Error updating payment', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payment marked as paid' });
      await logActivity('MARK_PAID', payment.id, { amount: payment.amount });
      fetchPayments();
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Management</CardTitle>
            <CardDescription>Track and manage driver payments</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">${totalPending.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Pending</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Tour</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No payments recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.drivers ? (
                        <div>
                          <p className="font-medium">{payment.drivers.name}</p>
                          <p className="text-xs text-muted-foreground">{payment.drivers.driver_number}</p>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>{payment.tours?.booking_ref || 'N/A'}</TableCell>
                    <TableCell>{payment.tours?.customer_name || 'N/A'}</TableCell>
                    <TableCell className="font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsPaid(payment)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Paid
                        </Button>
                      )}
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

export default PaymentManagement;
