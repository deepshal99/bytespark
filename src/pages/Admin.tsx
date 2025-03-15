
import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const Admin = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<any>(null);

  const runAction = async (action: string) => {
    setLoading(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('manual-run', {
        body: { action, email: email || undefined }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      setResults(data);
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} operation completed successfully`);
    } catch (err) {
      console.error(`Error running ${action}:`, err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">ByteSize Admin Panel</h1>
      
      <Tabs defaultValue="actions">
        <TabsList className="mb-6">
          <TabsTrigger value="actions">Manual Actions</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>
        
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Run Manual Actions</CardTitle>
              <CardDescription>
                Manually trigger the newsletter system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label htmlFor="email">Target Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="max-w-md"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  If specified, only process this email address
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Button 
                  onClick={() => runAction('fetch')} 
                  disabled={loading}
                  className="w-full"
                >
                  Fetch Tweets
                </Button>
                <Button 
                  onClick={() => runAction('summarize')} 
                  disabled={loading}
                  className="w-full"
                >
                  Summarize Tweets
                </Button>
                <Button 
                  onClick={() => runAction('send')} 
                  disabled={loading}
                  className="w-full"
                >
                  Send Newsletters
                </Button>
              </div>
              
              <Separator className="my-6" />
              
              <div className="text-center">
                <Button 
                  onClick={() => runAction('all')} 
                  disabled={loading}
                  className="w-full max-w-md"
                  variant="outline"
                >
                  Run Complete Pipeline
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  Fetch, summarize, and send in sequence
                </p>
              </div>
              
              <Separator className="my-6" />
              
              <div className="text-center">
                <Button 
                  onClick={() => runAction('test')} 
                  disabled={loading}
                  className="w-full max-w-md"
                  variant="secondary"
                >
                  Test System (Non-destructive)
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  Test the complete pipeline without affecting production data
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                View the results of the last operation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center p-8">
                  <div className="animate-pulse">
                    <p>Processing...</p>
                  </div>
                </div>
              ) : results ? (
                <pre className="bg-slate-100 p-4 rounded-md overflow-auto max-h-[500px]">
                  {JSON.stringify(results, null, 2)}
                </pre>
              ) : (
                <p className="text-center p-8 text-muted-foreground">
                  Run an action to see results
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
