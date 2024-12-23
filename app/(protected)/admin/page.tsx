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
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 5;

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
  const [currentSearchPage, setCurrentSearchPage] = useState(1);
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [currentTransactionPage, setCurrentTransactionPage] = useState(1);

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

  // Calculate total pages for each section
  const totalSearchPages = Math.ceil(
    filteredSearches.filter((s) => s.status === "pending").length /
      ITEMS_PER_PAGE
  );
  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const totalTransactionPages = Math.ceil(
    filteredTransactions.length / ITEMS_PER_PAGE
  );

  // Get current page items for each section
  const getCurrentSearchItems = () => {
    const startIndex = (currentSearchPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredSearches
      .filter((s) => s.status === "pending")
      .slice(startIndex, endIndex);
  };

  const getCurrentUserItems = () => {
    const startIndex = (currentUserPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, endIndex);
  };

  const getCurrentTransactionItems = () => {
    const startIndex = (currentTransactionPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, endIndex);
  };

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
          <TabsTrigger value="searches">Consultas</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
        </TabsList>

        <TabsContent value="searches">
          <Card>
            <CardHeader className="flex flex-col space-y-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle>Consultas pendientes</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Página {currentSearchPage} de {totalSearchPages || 1}
                </div>
              </div>
              <Input
                placeholder="Buscar por nombre, categoría o consulta..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentSearchPage(1); // Reset to first page when searching
                }}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getCurrentSearchItems().map((search) => (
                  <div
                    key={search.id}
                    className="border p-4 rounded-lg bg-card break-words"
                  >
                    <div className="font-medium break-all">
                      {search.users?.username} - {search.category}
                    </div>
                    <div className="text-muted-foreground text-sm break-words">
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
                      Añadir resultado
                    </Button>
                  </div>
                ))}
                {totalSearchPages > 1 && (
                  <div className="flex justify-center items-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentSearchPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentSearchPage === 1}
                      className="w-[100px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {currentSearchPage} / {totalSearchPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentSearchPage((prev) =>
                          Math.min(totalSearchPages, prev + 1)
                        )
                      }
                      disabled={currentSearchPage === totalSearchPages}
                      className="w-[100px]"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
            <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Añadir resultado de consulta</DialogTitle>
                <DialogDescription>
                  Añadir resultado de consulta por{" "}
                  {selectedSearch?.users?.username}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="font-medium">Consulta</Label>
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
                  <Label htmlFor="result">Resultado</Label>
                  <Textarea
                    id="result"
                    placeholder="Enter result text..."
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Adjuntar archivo (Opcional)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="text-sm text-muted-foreground">
                      Archivo seleccionado: {selectedFile.name}
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
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitResult}
                    disabled={loading || (!result && !selectedFile)}
                    className="flex items-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Enviando..." : "Enviar resultado"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col space-y-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle>Usuarios</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Página {currentUserPage} de {totalUserPages || 1}
                </div>
              </div>
              <Input
                placeholder="Buscar por nombre o rol..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  setCurrentUserPage(1); // Reset to first page when searching
                }}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getCurrentUserItems().map((user) => (
                  <div key={user.id} className="border p-4 rounded-lg bg-card">
                    <div className="font-medium break-all">{user.username}</div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="text-muted-foreground text-sm flex items-center flex-wrap gap-2">
                        Créditos:
                        <Input
                          type="number"
                          value={user.credits}
                          className="w-24 inline-block"
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
                {totalUserPages > 1 && (
                  <div className="flex justify-center items-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentUserPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentUserPage === 1}
                      className="w-[100px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {currentUserPage} / {totalUserPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentUserPage((prev) =>
                          Math.min(totalUserPages, prev + 1)
                        )
                      }
                      disabled={currentUserPage === totalUserPages}
                      className="w-[100px]"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-col space-y-4">
              <div className="flex flex-row items-center justify-between w-full">
                <CardTitle>Todas las transacciones</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentTransactionPage} de{" "}
                    {totalTransactionPages || 1}
                  </div>
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
              <Input
                placeholder="Buscar por nombre, número de pedido o estado..."
                value={transactionSearchQuery}
                onChange={(e) => {
                  setTransactionSearchQuery(e.target.value);
                  setCurrentTransactionPage(1); // Reset to first page when searching
                }}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getCurrentTransactionItems().map((transaction) => (
                  <div
                    key={transaction.id}
                    className="border p-4 rounded-lg bg-card"
                  >
                    <div className="font-medium break-all">
                      Usuario:{" "}
                      <span className="text-red-500 break-words">
                        {transaction.users?.username}
                      </span>
                      <div className="text-sm break-all">
                        Número de pedido: {transaction.order_number}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div>
                        <div className="text-muted-foreground text-sm break-words">
                          Cantidad: €{transaction.amount}
                        </div>
                        <div className="text-muted-foreground text-sm break-words">
                          Créditos: {transaction.credits}
                        </div>
                        <div className="text-muted-foreground text-sm flex flex-wrap gap-1">
                          Estado:{" "}
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
                              <span className="whitespace-nowrap">
                                (Expira en:{" "}
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
                          <div className="text-muted-foreground text-sm break-words">
                            Cantidad en cripto: {transaction.crypto_amount}{" "}
                            {transaction.crypto_currency}
                          </div>
                          <div className="text-muted-foreground text-sm break-words">
                            Tasa de cambio: {transaction.exchange_rate}
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
                          className="text-blue-500 hover:text-blue-700 text-sm break-all"
                        >
                          Ver factura
                        </a>
                      </div>
                    )}
                    <div className="text-muted-foreground text-xs mt-2 break-words">
                      Creado:{" "}
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {totalTransactionPages > 1 && (
                  <div className="flex justify-center items-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentTransactionPage((prev) =>
                          Math.max(1, prev - 1)
                        )
                      }
                      disabled={currentTransactionPage === 1}
                      className="w-[100px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {currentTransactionPage} / {totalTransactionPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentTransactionPage((prev) =>
                          Math.min(totalTransactionPages, prev + 1)
                        )
                      }
                      disabled={
                        currentTransactionPage === totalTransactionPages
                      }
                      className="w-[100px]"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
