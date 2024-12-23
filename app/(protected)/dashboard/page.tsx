"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

const categories = [
  { id: "category1", name: "Category 1" },
  { id: "category2", name: "Category 2" },
  { id: "category3", name: "Category 3" },
  { id: "category4", name: "Category 4" },
];

const ITEMS_PER_PAGE = 5;

interface Search {
  id: string;
  category: string;
  query: string;
  status: string;
  result?: string;
  result_file?: string;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [searches, setSearches] = useState<Search[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total pages
  const totalPages = Math.ceil(searches.length / ITEMS_PER_PAGE);

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return searches.slice(startIndex, endIndex);
  };

  // Handle page navigation
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Load initial data
  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      // Get user credits
      const { data: userData } = await supabase
        .from("users")
        .select("credits")
        .eq("id", session?.user?.id)
        .single();

      if (userData) {
        setCredits(userData.credits);
      }

      // Get user searches
      const { data: searchesData } = await supabase
        .from("searches")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("created_at", { ascending: false });

      if (searchesData) {
        setSearches(searchesData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      router.push("/login");
      return;
    }

    if (credits < 1) {
      toast({
        variant: "destructive",
        title: "Insufficient Credits",
        description: "Please purchase more credits to continue searching.",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("searches").insert({
        user_id: session.user.id,
        category,
        query,
        status: "pending",
      });

      if (error) {
        throw error;
      }

      await supabase.rpc("deduct_credits", {
        user_id: session.user.id,
        amount: 1,
      });

      await loadData();
      setQuery("");
      setCurrentPage(1); // Reset to first page after new search

      toast({
        title: "Search Submitted",
        description: "Your search request has been submitted successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = async (fileUrl: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "search-result.txt";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  return (
    <div className="space-y-8 px-4 md:px-8 max-w-7xl mx-auto">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "h-16 sm:h-20 rounded-lg border-2 border-border p-2 sm:p-4 text-center transition-all hover:border-primary break-words",
                    category === cat.id &&
                      "border-primary bg-primary/10 text-primary"
                  )}
                >
                  <span className="text-sm sm:text-base">{cat.name}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Enter your search query"
                value={query}
                maxLength={100}
                onChange={(e) => setQuery(e.target.value)}
                className="hover:bg-[#252525] w-full"
              />
              <div className="text-xs text-muted-foreground text-right">
                {query.length}/100 characters
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-lg font-medium">Credits: {credits}</div>
              <Button
                type="submit"
                disabled={loading || !category || !query}
                className="w-full sm:w-auto min-w-[200px]"
              >
                Search (1 Credit)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Past Searches</CardTitle>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {searches.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No searches found
              </div>
            ) : (
              <>
                {getCurrentPageItems().map((search) => (
                  <div
                    key={search.id}
                    className="border border-border rounded-lg p-4 bg-card space-y-2"
                  >
                    <div className="font-medium break-words">
                      {search.category}
                    </div>
                    <div className="text-muted-foreground text-sm break-words">
                      {search.query}
                    </div>
                    <div className="mt-2">
                      {search.status === "completed" ? (
                        <div className="space-y-3">
                          <div className="text-green-400 break-words text-sm">
                            {search.result}
                          </div>
                          {search.result_file && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                downloadResult(search.result_file!)
                              }
                              className="w-full sm:w-auto"
                            >
                              Download Result
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-yellow-400 text-sm">Pending</div>
                      )}
                    </div>
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="w-[100px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="w-[100px]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
