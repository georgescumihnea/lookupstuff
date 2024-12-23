"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  credits: number;
  role: string;
}

interface Search {
  id: string;
  user_id: string;
  category: string;
  query: string;
  status: string;
  result?: string;
  result_file?: string;
  users?: {
    username: string;
  };
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  credits: number;
  status: string;
  payment_id?: string;
  invoice_url?: string;
  crypto_amount?: number;
  crypto_currency?: string;
  exchange_rate?: number;
  created_at: string;
  order_number?: string;
  expires_at?: string;
  users?: {
    username: string;
  };
}

function CountdownTimer({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiryDate).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiryDate]);

  return <span className="font-mono">{timeLeft}</span>;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searches, setSearches] = useState<Search[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<Search | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCheckingTransactions, setIsCheckingTransactions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [updatingCredits, setUpdatingCredits] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");

  const filteredSearches = searches.filter((search) => {
    const searchText =
      `${search.users?.username} ${search.category} ${search.query}`.toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  });

  const filteredUsers = users.filter((user) => {
    const searchText = `${user.username} ${user.role}`.toLowerCase();
    return searchText.includes(userSearchQuery.toLowerCase());
  });

  const filteredTransactions = transactions.filter((transaction) => {
    const searchText =
      `${transaction.users?.username} ${transaction.order_number} ${transaction.status}`.toLowerCase();
    return searchText.includes(transactionSearchQuery.toLowerCase());
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: searchesData } = await supabase
        .from("searches")
        .select("*, users(username)")
        .order("created_at", { ascending: false });

      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*, users(username)")
        .order("created_at", { ascending: false });

      if (searchesData) setSearches(searchesData as Search[]);
      if (usersData) setUsers(usersData as User[]);
      if (transactionsData) setTransactions(transactionsData as Transaction[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmitResult = async () => {
    if (!selectedSearch || (!result && !selectedFile)) return;

    setLoading(true);
    try {
      let resultFileUrl = "";

      if (selectedFile) {
        try {
          // Check admin role from NextAuth session
          if (session?.user?.role !== "admin") {
            throw new Error("Unauthorized: Only admins can upload files");
          }

          // Create a unique file path
          const timestamp = Date.now();
          const safeFileName = selectedFile.name.replace(
            /[^a-zA-Z0-9.-]/g,
            "_"
          );
          const fileName = `search-results/${selectedSearch.user_id}/${timestamp}_${safeFileName}`;

          // Upload the file
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from("search-results")
              .upload(fileName, selectedFile, {
                cacheControl: "3600",
                contentType: "text/plain",
                upsert: true,
              });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error(uploadError.message || "Failed to upload file");
          }

          // Get the public URL
          const { data } = supabase.storage
            .from("search-results")
            .getPublicUrl(fileName);

          resultFileUrl = data.publicUrl;
          console.log("File uploaded successfully:", resultFileUrl);
        } catch (uploadError: any) {
          console.error("File upload error:", uploadError);
          toast({
            variant: "destructive",
            title: "Upload Error",
            description:
              uploadError.message || "Failed to upload file. Please try again.",
          });
          setLoading(false);
          return;
        }
      }

      // Update the search record
      const { error: updateError } = await supabase
        .from("searches")
        .update({
          status: "completed",
          result: result || null,
          result_file: resultFileUrl || null,
        })
        .eq("id", selectedSearch.id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(
          updateError.message || "Failed to update search result"
        );
      }

      await fetchData();
      setShowResultDialog(false);
      setSelectedSearch(null);
      setResult("");
      setSelectedFile(null);

      toast({
        title: "Success",
        description: "Search result has been submitted successfully.",
      });
    } catch (error: any) {
      console.error("Error submitting result:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "Failed to submit search result. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserCredits = async (userId: string, newCredits: number) => {
    setUpdatingCredits(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ credits: newCredits })
        .eq("id", userId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error updating credits:", error);
    } finally {
      setUpdatingCredits(false);
    }
  };

  const checkAllTransactions = async () => {
    setIsCheckingTransactions(true);
    try {
      const response = await fetch("/api/check-invoices");
      if (!response.ok) {
        throw new Error("Failed to check transactions");
      }
      await fetchData(); // Refresh the data after updating
    } catch (error) {
      console.error("Error checking transactions:", error);
    } finally {
      setIsCheckingTransactions(false);
    }
  };

  // If not admin, don't render anything (will be redirected)
  if (session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4 text-red-500">Admin Panel</h1>
      <Tabs defaultValue="searches">
        <TabsList>
          <TabsTrigger value="searches">Searches</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="searches">
          <Card>
            <CardHeader>
              <CardTitle>Pending Searches</CardTitle>
              <div className="mt-2">
                <Input
                  placeholder="Search by username, category, or query..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSearches
                  .filter((s) => s.status === "pending")
                  .map((search) => (
                    <div
                      key={search.id}
                      className="border p-4 rounded-lg bg-card"
                    >
                      <div className="font-medium">
                        {search.users?.username} - {search.category}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {search.query}
                      </div>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setSelectedSearch(search);
                          setShowResultDialog(true);
                        }}
                      >
                        Add Result
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add Search Result</DialogTitle>
                <DialogDescription>
                  Adding result for search by {selectedSearch?.users?.username}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="font-medium">Search Query</Label>
                  <div className="p-2 rounded bg-card">
                    <div className="font-medium">
                      {selectedSearch?.category}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedSearch?.query}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="result">Result Text</Label>
                  <Textarea
                    id="result"
                    placeholder="Enter result text..."
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Attach File (Optional)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="text-sm text-muted-foreground">
                      Selected file: {selectedFile.name}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowResultDialog(false);
                      setSelectedSearch(null);
                      setResult("");
                      setSelectedFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitResult}
                    disabled={loading || (!result && !selectedFile)}
                    className="flex items-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Submitting..." : "Submit Result"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <div className="mt-2">
                <Input
                  placeholder="Search by username or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="border p-4 rounded-lg bg-card">
                    <div className="font-medium">{user.username}</div>
                    <div className="flex items-center gap-4">
                      <div className="text-muted-foreground text-sm">
                        Credits:
                        <Input
                          type="number"
                          value={user.credits}
                          className="w-24 ml-2 inline-block"
                          onChange={(e) => {
                            const newCredits = parseInt(e.target.value);
                            if (!isNaN(newCredits)) {
                              updateUserCredits(user.id, newCredits);
                            }
                          }}
                          disabled={updatingCredits}
                        />
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Role: {user.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>All Transactions</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={checkAllTransactions}
                    disabled={isCheckingTransactions}
                    className="flex items-center gap-2"
                  >
                    {isCheckingTransactions && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isCheckingTransactions
                      ? "Checking..."
                      : "Check All Transactions"}
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <Input
                  placeholder="Search by username, order number, or status..."
                  value={transactionSearchQuery}
                  onChange={(e) => setTransactionSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="border p-4 rounded-lg bg-card"
                  >
                    <div className="font-medium">
                      Username:{" "}
                      <span className="text-red-500">
                        {transaction.users?.username}
                      </span>
                      - Order #{transaction.order_number}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-muted-foreground text-sm">
                          Amount: €{transaction.amount}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Credits: {transaction.credits}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Status:{" "}
                          <span
                            className={
                              transaction.status === "completed"
                                ? "text-green-500"
                                : transaction.status === "failed"
                                  ? "text-red-500"
                                  : "text-yellow-500"
                            }
                          >
                            {transaction.status}
                          </span>
                          {transaction.expires_at &&
                            transaction.status === "new" && (
                              <span className="ml-2">
                                (Expires in:{" "}
                                <CountdownTimer
                                  expiryDate={transaction.expires_at}
                                />
                                )
                              </span>
                            )}
                        </div>
                      </div>
                      {transaction.crypto_amount && (
                        <div>
                          <div className="text-muted-foreground text-sm">
                            Crypto Amount: {transaction.crypto_amount}{" "}
                            {transaction.crypto_currency}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Exchange Rate: {transaction.exchange_rate}
                          </div>
                        </div>
                      )}
                    </div>
                    {transaction.invoice_url && (
                      <div className="mt-2">
                        <a
                          href={transaction.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          View Invoice
                        </a>
                      </div>
                    )}
                    <div className="text-muted-foreground text-xs mt-2">
                      Created:{" "}
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
